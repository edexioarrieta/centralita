import type { CallResult } from '@/types';

/**
 * Estado de una llamada telefonica.
 * - idle: sin actividad
 * - dialing: marcando
 * - ringing: sonando
 * - connected: en conversacion
 * - ended: finalizada
 */
export type CallState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended';

/**
 * Resultado de iniciar una llamada.
 */
export interface MakeCallResult {
  callId: string;
  state: CallState;
}

/**
 * Informacion de la llamada en curso.
 */
export interface ActiveCall {
  callId: string;
  loanId: string;
  phoneNumber: string;
  state: CallState;
  startedAt: Date;
  durationSeconds: number;
}

/**
 * Registro que se guarda al finalizar una llamada.
 */
export interface CallRecord {
  callId: string;
  loanId: string;
  durationSeconds: number;
  result: CallResult;
  notes: string;
  recordingUrl?: string;
}

/**
 * Interfaz comun para todos los proveedores de telefonia.
 *
 * El CRM interactua SOLO con esta interfaz. Para integrar un nuevo
 * proveedor (Zadarma, Twilio, etc.) basta con implementar esta interfaz
 * y registrarlo en providers/index.ts. No es necesario modificar el
 * resto del CRM.
 *
 * Metodos:
 * - makeCall():     inicia una llamada hacia un numero.
 * - hangup():       finaliza la llamada en curso.
 * - getCallStatus(): devuelve el estado actual de la llamada.
 * - recordCall():   guarda los datos del resultado de la llamada.
 */
export interface VoiceProvider {
  /** Identificador unico del proveedor (ej: 'mock', 'zadarma'). */
  readonly name: string;

  /** Indica si el proveedor esta activo y configurado. */
  readonly configured: boolean;

  /** Inicia una llamada telefonica. */
  makeCall(loanId: string, phoneNumber: string): Promise<MakeCallResult>;

  /** Finaliza la llamada en curso. */
  hangup(): Promise<void>;

  /** Devuelve el estado actual de la llamada activa, o null si no hay. */
  getCallStatus(): ActiveCall | null;

  /** Guarda el registro del resultado de una llamada finalizada. */
  recordCall(record: CallRecord): Promise<void>;

  /** Suscripcion a cambios de estado de la llamada. */
  onStateChange(listener: (state: CallState, call: ActiveCall | null) => void): () => void;
}
