import { supabase } from '@/lib/supabase';
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
      startedAt: new Date(),
      durationSeconds: 0,
    };
    this.notify();

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
