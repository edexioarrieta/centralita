import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Call } from '@/types';
import type {
  ActiveCall,
  CallRecord,
  CallState,
  MakeCallResult,
  VoiceProvider,
} from '@/providers/VoiceProvider';

/**
 * Proveedor de telefonia Zadarma (cliente frontend).
 *
 * NO contiene ni firma credenciales de Zadarma. Las claves viven
 * exclusivamente en el servidor (Edge Function "voice") como secretos
 * privados ZADARMA_KEY / ZADARMA_SECRET. Este cliente solo llama a
 * endpoints internos del backend:
 *
 *   POST /functions/v1/voice/call
 *   POST /functions/v1/voice/hangup
 *   GET  /functions/v1/voice/status
 *   POST /functions/v1/voice/record
 *
 * Toda la autenticacion y firma HMAC de Zadarma se genera en el servidor,
 * nunca en el navegador.
 *
 * Autenticacion del endpoint /call: se envia el JWT de la sesion activa
 * del usuario del CRM (no la clave publica anon). El backend rechaza
 * cualquier peticion que no venga de un usuario autenticado.
 */
export class ZadarmaProvider implements VoiceProvider {
  readonly name = 'zadarma';
  readonly configured = true;

  private readonly baseUrl: string;
  private active: ActiveCall | null = null;
  private channel: RealtimeChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshInFlight = false;
  private stateListeners = new Set<(state: CallState, call: ActiveCall | null) => void>();

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice`;
  }

  /** Cabeceras con el JWT de la sesion activa del usuario. */
  private async authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('No hay sesion activa. Inicia sesion en el CRM.');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async makeCall(loanId: string, phoneNumber: string): Promise<MakeCallResult> {
    const extension = '100';
    const res = await fetch(`${this.baseUrl}/call`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify({ phone: phoneNumber, extension, loanId }),
    });
    if (!res.ok) throw new Error(await this.extractError(res));
    const data = (await res.json()) as MakeCallResult;

    this.active = {
      callId: data.callId,
      loanId,
      phoneNumber,
      state: data.state ?? 'dialing',
      providerStatus: 'initiated',
      extension,
      startedAt: new Date(),
      durationSeconds: 0,
    };
    this.notify();
    await this.watchCall(data.callId);

    return data;
  }

  async hangup(): Promise<void> {
    if (this.active) {
      this.active = { ...this.active, state: 'ended' };
      this.notify();
    }
    try {
      await fetch(`${this.baseUrl}/hangup`, {
        method: 'POST',
        headers: await this.authHeaders(),
      });
    } catch {
      // El estado local ya refleja el colgado; errores de red no bloquean el flujo.
    }
    setTimeout(() => {
      if (this.active?.state === 'ended') {
        this.active = null;
        this.notify();
      }
    }, 500);
  }

  getCallStatus(): ActiveCall | null {
    if (!this.active) return null;
    return { ...this.active };
  }

  async recordCall(record: CallRecord): Promise<void> {
    const res = await fetch(`${this.baseUrl}/record`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(await this.extractError(res));
  }

  onStateChange(listener: (state: CallState, call: ActiveCall | null) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  clearActiveCall(): void {
    this.stopWatching();
    this.active = null;
    this.notify();
  }

  private async watchCall(callId: string): Promise<void> {
    this.stopWatching();

    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => this.applyCallRow(payload.new as Call),
      );
    this.channel = channel;

    channel.subscribe((status) => {
      // Si el websocket se degrada, el polling mantiene la fila sincronizada.
      // Supabase Realtime intentara reconectar el canal por su cuenta.
      if (status === 'SUBSCRIBED') {
        void this.refreshCall(callId);
      }
    });

    // La consulta posterior a la suscripcion recupera cualquier evento rapido
    // ocurrido mientras se establecia el canal.
    await this.refreshCall(callId, true);
    if (this.active?.callId === callId && this.active.state !== 'ended') {
      this.pollTimer = setInterval(() => void this.refreshCall(callId), 1500);
    }
  }

  private async refreshCall(callId: string, throwOnError = false): Promise<void> {
    if (this.refreshInFlight || this.active?.callId !== callId) return;
    this.refreshInFlight = true;
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
      if (error) {
        if (throwOnError) {
          throw new Error(`No se pudo seguir el estado de la llamada: ${error.message}`);
        }
        return;
      }
      this.applyCallRow(data as Call);
    } finally {
      this.refreshInFlight = false;
    }
  }

  private applyCallRow(row: Call): void {
    if (!this.active || row.id !== this.active.callId) return;

    this.active = {
      ...this.active,
      phoneNumber: row.destination ?? this.active.phoneNumber,
      state: mapProviderStatus(row.status),
      providerStatus: row.status,
      extension: row.extension,
      startedAt: new Date(row.started_at),
      answeredAt: row.answered_at ? new Date(row.answered_at) : null,
      durationSeconds: row.duration ?? 0,
    };
    this.notify();

    if (this.active.state === 'ended') {
      this.stopWatching();
    }
  }

  private stopWatching(): void {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private notify(): void {
    const state = this.active?.state ?? 'idle';
    this.stateListeners.forEach((l) => l(state, this.getCallStatus()));
  }

  private async extractError(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as { error?: string };
      return body.error ?? `Error ${res.status} en el servidor de voz`;
    } catch {
      return `Error ${res.status} en el servidor de voz`;
    }
  }
}

function mapProviderStatus(status: string): CallState {
  const normalized = status.toLowerCase();
  if (['answered', 'connected'].includes(normalized)) return 'connected';
  if (normalized === 'ringing') return 'ringing';
  if (
    ['completed', 'failed', 'no_answer', 'busy', 'cancelled', 'canceled'].includes(normalized)
  ) {
    return 'ended';
  }
  return 'dialing';
}
