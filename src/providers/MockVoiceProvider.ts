import type {
  ActiveCall,
  CallRecord,
  CallState,
  MakeCallResult,
  VoiceProvider,
} from '@/providers/VoiceProvider';

/**
 * Proveedor de voz de simulacion.
 *
 * No realiza llamadas reales. Simula el ciclo de vida de una llamada
 * (marcado -> sonando -> conectado -> finalizado) para permitir probar
 * el flujo completo del CRM sin integrar telefonia.
 *
 * Cumple la interfaz VoiceProvider, por lo que el CRM no distingue
 * entre este proveedor y uno real como ZadarmaProvider.
 */
export class MockVoiceProvider implements VoiceProvider {
  readonly name = 'mock';
  readonly configured = true;

  private active: ActiveCall | null = null;
  private stateListeners = new Set<(state: CallState, call: ActiveCall | null) => void>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  async makeCall(loanId: string, phoneNumber: string): Promise<MakeCallResult> {
    const callId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date();

    this.active = {
      callId,
      loanId,
      phoneNumber,
      state: 'dialing',
      startedAt,
      durationSeconds: 0,
    };

    this.notify();
    this.startTick();

    // Simula la transicion: dialing -> ringing -> connected
    setTimeout(() => this.transitionTo('ringing'), 600);
    setTimeout(() => this.transitionTo('connected'), 1400);

    return { callId, state: 'dialing' };
  }

  async hangup(): Promise<void> {
    if (this.active) {
      this.active = { ...this.active, state: 'ended' };
      this.notify();
    }
    this.stopTick();
    // Mantenemos la llamada breve para que getCallStatus devuelva 'ended'
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
    // En el provider real esto guardaria metadata de la grabacion.
    // Aqui solo dejamos registro en consola para depuracion.
    void record;
  }

  onStateChange(listener: (state: CallState, call: ActiveCall | null) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  clearActiveCall(): void {
    this.stopTick();
    this.active = null;
    this.notify();
  }

  private transitionTo(state: CallState): void {
    if (!this.active) return;
    this.active = { ...this.active, state };
    this.notify();
  }

  private startTick(): void {
    this.stopTick();
    this.tickTimer = setInterval(() => {
      if (this.active && this.active.state === 'connected') {
        const elapsed = Math.floor(
          (Date.now() - this.active.startedAt.getTime()) / 1000,
        );
        this.active = { ...this.active, durationSeconds: elapsed };
        this.notify();
      }
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private notify(): void {
    const state = this.active?.state ?? 'idle';
    this.stateListeners.forEach((l) => l(state, this.getCallStatus()));
  }
}
