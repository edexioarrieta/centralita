import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Hash,
  Calendar,
  PhoneCall,
  PhoneOff,
  X,
  CheckCircle2,
  CalendarClock,
  Clock,
  History,
  MessageSquare,
  PhoneIncoming,
  Info,
  AlertCircle,
  Voicemail,
} from 'lucide-react';
import {
  fetchLoanById,
  fetchCallsByLoan,
  fetchCallLogsByLoan,
  updateLoan,
  createCall,
  updateCallOutcome,
  createCallRecordingUrl,
  addObservationLog,
} from '@/lib/api';
import { queryKeys, invalidateLoanQueries, invalidateLoanDetail } from '@/lib/query';
import { CALL_RESULTS } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { CallSimulatorModal } from '@/components/CallSimulatorModal';
import { getVoiceProvider, getMockVoiceProvider } from '@/providers';
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  countdown,
} from '@/lib/format';
import type { Call, CallLog, CallResult, EventType, LoanStatus } from '@/types';

const TECHNICAL_EVENT_TYPES = new Set([
  'cambio_estado',
  'notify_out_start',
  'notify_answer',
  'notify_out_end',
  'notify_record',
]);

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [mockCallModalOpen, setMockCallModalOpen] = useState(false);
  const [observation, setObservation] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  const { data: loan, isLoading } = useQuery({
    queryKey: queryKeys.loan(id!),
    queryFn: () => fetchLoanById(id!),
    enabled: !!id,
  });

  const { data: calls = [] } = useQuery({
    queryKey: queryKeys.calls(id!),
    queryFn: () => fetchCallsByLoan(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: queryKeys.callLogs(id!),
    queryFn: () => fetchCallLogsByLoan(id!),
    enabled: !!id,
  });
  const visibleLogs = logs.filter((log) => !TECHNICAL_EVENT_TYPES.has(log.event_type));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-slate-300" />
        <p className="mt-3 font-medium text-slate-600">Solicitud no encontrada</p>
        <Link to="/loans" className="mt-4 text-sm text-slate-900 underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  const status = loan.status as LoanStatus;
  const cd = countdown(loan.scheduled_call_at, new Date());
  const showCountdown = status === 'nuevo' || status === 'programado';

  const handleSaveCall = async ({
    callId,
    result,
    durationSeconds,
    notes,
    rescheduleAt,
  }: {
    callId: string;
    result: CallResult;
    durationSeconds: number;
    notes: string;
    rescheduleAt?: string;
  }, realCall: boolean) => {
    if (realCall) {
      await updateCallOutcome(callId, { result, notes });
    } else {
      const startedAt = new Date(Date.now() - durationSeconds * 1000).toISOString();
      const endedAt = new Date().toISOString();
      await createCall({
        loan_id: loan.id,
        operator_id: profile?.id ?? null,
        started_at: startedAt,
        ended_at: endedAt,
        duration: durationSeconds,
        result,
        notes,
        outcome_confirmed_at: endedAt,
      });
    }

    const nextStatus = CALL_RESULTS[result].nextStatus as LoanStatus;
    const patch: Parameters<typeof updateLoan>[1] = { status: nextStatus };
    if (result === 'volver_a_llamar' && rescheduleAt) {
      patch.scheduled_call_at = new Date(rescheduleAt).toISOString();
    }
    await updateLoan(loan.id, patch);

    invalidateLoanQueries();
    invalidateLoanDetail(loan.id);
  };

  const handleSaveObservation = async () => {
    if (!observation.trim()) return;
    setSavingObs(true);
    try {
      await addObservationLog(loan.id, observation.trim(), profile?.id ?? null);
      setObservation('');
      invalidateLoanDetail(loan.id);
    } catch {
      // error silencioso: el query refetch mostrará datos consistentes
    } finally {
      setSavingObs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="space-y-4">
        <button
          onClick={() => navigate('/loans')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {loan.first_name} {loan.last_name}
              </h1>
              <StatusBadge status={status} size="md" />
            </div>
            <p className="mt-1 font-mono text-sm text-slate-500">{loan.loan_number}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setCallModalOpen(true)}>
              <Phone className="h-4 w-4" />
              Llamar
            </Button>
            <Button variant="secondary" onClick={() => setMockCallModalOpen(true)}>
              <PhoneCall className="h-4 w-4" />
              Simular llamada
            </Button>
          </div>
        </div>

        {showCountdown && (
          <div
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              cd.isOverdue
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Clock className="h-4 w-4" />
            {cd.isOverdue ? 'Listo para llamar' : `Proxima llamada en ${cd.text}`}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna izquierda: datos */}
        <div className="space-y-6 lg:col-span-2">
          {/* Datos personales */}
          <Section title="Datos personales" icon={User}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={User} label="Nombre" value={`${loan.first_name} ${loan.last_name}`} />
              <InfoRow icon={CreditCard} label="DNI" value={loan.dni} />
              <InfoRow icon={Phone} label="Telefono" value={loan.phone} />
              <InfoRow icon={Mail} label="Email" value={loan.email} />
              <InfoRow icon={MapPin} label="Provincia" value={loan.province} />
            </div>
          </Section>

          {/* Datos del prestamo */}
          <Section title="Datos del prestamo" icon={DollarSign}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Hash} label="Numero" value={loan.loan_number} mono />
              <InfoRow icon={DollarSign} label="Capital" value={formatCurrency(loan.amount)} />
              <InfoRow icon={Calendar} label="Cuotas" value={`${loan.installments}`} />
              <InfoRow icon={Calendar} label="Fecha de solicitud" value={formatDate(loan.created_at)} />
              <InfoRow
                icon={CalendarClock}
                label="Llamada programada"
                value={formatDateTime(loan.scheduled_call_at)}
              />
              <InfoRow icon={Clock} label="Estado" value={<StatusBadge status={status} />} />
            </div>
          </Section>

          {/* Observaciones */}
          <Section title="Observaciones" icon={MessageSquare}>
            <div className="space-y-3">
              <Textarea
                rows={3}
                placeholder="Agregar una observacion sobre este prestamo..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={savingObs}
                  disabled={!observation.trim()}
                  onClick={handleSaveObservation}
                >
                  Agregar observacion
                </Button>
              </div>
            </div>
          </Section>

          {/* Historial de llamadas */}
          <Section title="Historial de llamadas" icon={PhoneCall} badge={calls.length}>
            {calls.length === 0 ? (
              <EmptyState icon={PhoneOff} text="Sin llamadas registradas" />
            ) : (
              <div className="space-y-3">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-start justify-between rounded-lg border border-slate-100 p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ResultIcon
                          result={call.result as CallResult}
                          active={!isTerminalCall(call) || !call.outcome_confirmed_at}
                        />
                        <span className="text-sm font-medium text-slate-900">
                          {isTerminalCall(call) && !call.outcome_confirmed_at
                            ? 'Pendiente de clasificación'
                            : isTerminalCall(call)
                            ? CALL_RESULTS[call.result as CallResult]?.label ?? call.result
                            : callStatusLabel(call.status)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(call.started_at)} · {formatDuration(call.duration)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Operador: {operatorName(call)} · Extensión: {call.extension ?? '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Proveedor: {call.provider === 'zadarma' ? 'Zadarma' : 'Simulador'}
                      </p>
                      {call.notes && (
                        <p className="text-sm text-slate-600">{call.notes}</p>
                      )}
                      {call.recording_url && (
                        <RecordingButton path={call.recording_url} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Columna derecha: cronologia */}
        <div className="space-y-6">
          <Section title="Cronologia" icon={History}>
            {visibleLogs.length === 0 ? (
              <EmptyState icon={Info} text="Sin eventos registrados" />
            ) : (
              <div className="relative space-y-4">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
                {visibleLogs.map((log) => (
                  <div key={log.id} className="relative flex gap-3">
                    <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-slate-200">
                      <EventIcon type={log.event_type as EventType} />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-medium text-slate-900">
                        {timelineDescription(log, calls)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(timelineDate(log, calls))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Modales */}
      <CallSimulatorModal
        open={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        loanId={loan.id}
        phoneNumber={loan.phone}
        operatorId={profile?.id ?? null}
        provider={getVoiceProvider()}
        title="Llamar"
        realCall
        onSaved={(data) => handleSaveCall(data, true)}
      />

      <CallSimulatorModal
        open={mockCallModalOpen}
        onClose={() => setMockCallModalOpen(false)}
        loanId={loan.id}
        phoneNumber={loan.phone}
        operatorId={profile?.id ?? null}
        provider={getMockVoiceProvider()}
        title="Simular llamada"
        onSaved={(data) => handleSaveCall(data, false)}
      />
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function Section({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-400" />
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof User; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function ResultIcon({ result, active = false }: { result: CallResult; active?: boolean }) {
  if (active) return <PhoneCall className="h-4 w-4 text-indigo-600" />;
  if (result === 'atendido') return <Phone className="h-4 w-4 text-emerald-600" />;
  if (result === 'no_contesto') return <PhoneOff className="h-4 w-4 text-orange-500" />;
  if (result === 'buzon_voz') return <Voicemail className="h-4 w-4 text-violet-600" />;
  if (result === 'rechazado') return <X className="h-4 w-4 text-rose-600" />;
  return <CalendarClock className="h-4 w-4 text-amber-600" />;
}

function RecordingButton({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const openRecording = async () => {
    const popup = window.open('', '_blank');
    setOpening(true);
    setError('');
    try {
      const signedUrl = await createCallRecordingUrl(path);
      if (popup) {
        popup.opener = null;
        popup.location.href = signedUrl;
      } else {
        window.location.assign(signedUrl);
      }
    } catch {
      popup?.close();
      setError('No se pudo abrir la grabación');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={openRecording}
        disabled={opening}
        className="inline-flex text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-60"
      >
        {opening ? 'Preparando grabación…' : 'Escuchar grabación'}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function isTerminalCall(call: Call): boolean {
  return ['completed', 'failed', 'no_answer', 'busy', 'cancelled', 'canceled'].includes(
    call.status,
  );
}

function callStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: 'Creada',
    initiated: 'Iniciando',
    dialing: 'Marcando',
    ringing: 'Sonando',
    answered: 'Atendida',
    connected: 'Conectada',
    completed: 'Finalizada',
    failed: 'Fallida',
    no_answer: 'No contestó',
    busy: 'Ocupado',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
  };
  return labels[status] ?? status;
}

function operatorName(call: Call): string {
  if (!call.operator) return '—';
  return `${call.operator.first_name} ${call.operator.last_name}`.trim() || '—';
}

function timelineDescription(log: CallLog, calls: Call[]): string {
  if (log.event_type === 'inicio_llamada') {
    const name = log.operator
      ? `${log.operator.first_name} ${log.operator.last_name}`.trim()
      : '';
    return name ? `Llamada iniciada por ${name}` : 'Llamada iniciada';
  }

  if (log.event_type === 'fin_llamada') {
    const call = callForLog(log, calls);
    if (call) {
      const operator = operatorName(call);
      const extension = call.extension ? ` · Ext. ${call.extension}` : '';
      if (isTerminalCall(call)) {
        const result = call.outcome_confirmed_at
          ? CALL_RESULTS[call.result]?.label ?? call.result
          : 'Pendiente de clasificación';
        const connected = call.answered_at ? 'Cliente conectado · ' : '';
        return `${connected}Llamada finalizada · ${formatDuration(call.duration)} · ${result} · ${operator}${extension}`;
      }
      return `Llamada iniciada por ${operator}${extension}`;
    }
  }

  return log.description;
}

function timelineDate(log: CallLog, calls: Call[]): string {
  if (log.event_type !== 'fin_llamada') return log.created_at;
  const call = callForLog(log, calls);
  return call?.ended_at ?? call?.started_at ?? log.created_at;
}

function callForLog(log: CallLog, calls: Call[]): Call | undefined {
  const callId = typeof log.metadata?.call_id === 'string' ? log.metadata.call_id : null;
  return callId ? calls.find((call) => call.id === callId) : undefined;
}

function EventIcon({ type }: { type: EventType }) {
  const cls = 'h-3 w-3 text-slate-500';
  if (type === 'solicitud_creada') return <Info className={cls} />;
  if (type === 'cambio_estado') return <CheckCircle2 className={cls} />;
  if (type === 'asignacion_operador') return <User className={cls} />;
  if (type === 'reprogramacion') return <CalendarClock className={cls} />;
  if (type === 'fin_llamada') return <PhoneCall className={cls} />;
  if (type === 'inicio_llamada') return <PhoneIncoming className={cls} />;
  if (type === 'observacion') return <MessageSquare className={cls} />;
  return <Info className={cls} />;
}
