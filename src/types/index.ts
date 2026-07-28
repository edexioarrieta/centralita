import type { Database } from '@/types/database';

export type LoanStatus =
  | 'nuevo'
  | 'programado'
  | 'listo_para_llamar'
  | 'llamando'
  | 'atendido'
  | 'no_contesto'
  | 'rechazado'
  | 'finalizado';

export type CallResult =
  | 'atendido'
  | 'no_contesto'
  | 'buzon_voz'
  | 'rechazado'
  | 'volver_a_llamar';

export type UserRole = 'admin' | 'operator';

export type EventType =
  | 'solicitud_creada'
  | 'cambio_estado'
  | 'asignacion_operador'
  | 'reprogramacion'
  | 'inicio_llamada'
  | 'fin_llamada'
  | 'observacion'
  | 'notify_out_start'
  | 'notify_answer'
  | 'notify_out_end'
  | 'notify_record';

export type CallProvider = 'mock' | 'zadarma' | string;
export type CallTechnicalStatus =
  | 'created'
  | 'initiated'
  | 'dialing'
  | 'ringing'
  | 'answered'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'cancelled'
  | string;

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  extension: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  loan_number: string;
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  email: string;
  province: string;
  amount: number;
  installments: number;
  status: LoanStatus;
  assigned_user: string | null;
  scheduled_call_at: string;
  created_at: string;
  updated_at: string;
}

export interface LoanWithOperator extends Loan {
  operator?: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'email'> | null;
}

export interface Call {
  id: string;
  loan_id: string;
  operator_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration: number;
  result: CallResult;
  notes: string;
  created_at: string;
  provider: CallProvider;
  provider_call_id: string | null;
  status: CallTechnicalStatus;
  destination: string | null;
  extension: string | null;
  answered_at: string | null;
  recording_url: string | null;
  outcome_confirmed_at: string | null;
  provider_payload: Record<string, unknown> | null;
  operator?: Pick<UserProfile, 'id' | 'first_name' | 'last_name'> | null;
}

export interface CallLog {
  id: string;
  loan_id: string;
  event_type: EventType;
  description: string;
  previous_status: LoanStatus | null;
  new_status: LoanStatus | null;
  operator_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  provider_event_id: string | null;
  operator?: Pick<UserProfile, 'id' | 'first_name' | 'last_name'> | null;
}

export interface LoanInput {
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  email: string;
  province: string;
  amount: number;
  installments: number;
}

export interface CallInput {
  loan_id: string;
  operator_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration: number;
  result: CallResult;
  notes: string;
  outcome_confirmed_at?: string | null;
}

export type DB = Database;
