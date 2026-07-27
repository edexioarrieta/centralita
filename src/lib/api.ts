import { supabase } from '@/lib/supabase';
import type { Call, CallInput, CallLog, Loan, LoanInput, UserProfile } from '@/types';

// ============================================================
// Perfiles (users)
// ============================================================

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function fetchProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('first_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function canRegisterFirstUser(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_first_user');
  if (error) throw error;
  return Boolean(data);
}

// ============================================================
// Prestamos (loans)
// ============================================================

export async function fetchLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Loan[];
}

export async function fetchLoanById(id: string): Promise<Loan | null> {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Loan | null;
}

export async function createLoan(input: LoanInput): Promise<void> {
  const scheduledCallAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const { error } = await supabase.from('loans').insert({
    first_name: input.first_name,
    last_name: input.last_name,
    dni: input.dni,
    phone: input.phone,
    email: input.email,
    province: input.province,
    amount: input.amount,
    installments: input.installments,
    status: 'nuevo',
    scheduled_call_at: scheduledCallAt,
  });
  if (error) throw error;
}

export async function updateLoan(
  id: string,
  patch: Partial<Pick<Loan, 'status' | 'assigned_user' | 'scheduled_call_at'>>,
): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Loan;
}

// ============================================================
// Llamadas (calls)
// ============================================================

export async function fetchCallsByLoan(loanId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*, operator:users(id, first_name, last_name)')
    .eq('loan_id', loanId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Call[];
}

export async function createCall(input: CallInput): Promise<Call> {
  const { data, error } = await supabase
    .from('calls')
    .insert({
      loan_id: input.loan_id,
      operator_id: input.operator_id,
      started_at: input.started_at,
      ended_at: input.ended_at,
      duration: input.duration,
      result: input.result,
      notes: input.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Call;
}

export async function updateCallOutcome(
  callId: string,
  outcome: Pick<Call, 'result' | 'notes'>,
): Promise<Call> {
  const { data, error } = await supabase
    .from('calls')
    .update({
      result: outcome.result,
      notes: outcome.notes,
    })
    .eq('id', callId)
    .select()
    .single();
  if (error) throw error;
  return data as Call;
}

export async function createCallRecordingUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(path, 5 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ============================================================
// Cronologia (call_logs)
// ============================================================

export async function fetchCallLogsByLoan(loanId: string): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from('call_logs')
    .select('*, operator:users(id, first_name, last_name)')
    .eq('loan_id', loanId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CallLog[];
}

export async function addObservationLog(
  loanId: string,
  description: string,
  operatorId: string | null,
): Promise<void> {
  const { error } = await supabase.from('call_logs').insert({
    loan_id: loanId,
    event_type: 'observacion',
    description,
    operator_id: operatorId,
  });
  if (error) throw error;
}
