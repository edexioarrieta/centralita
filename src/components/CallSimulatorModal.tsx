import { useEffect, useState } from 'react';
import {
  Phone,
  PhoneOff,
  X,
  PhoneCall,
  AlertCircle,
  Clock,
  CalendarClock,
  Mic,
  Voicemail,
} from 'lucide-react';
import type { CallResult } from '@/types';
import { CALL_RESULTS } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Field';
import { formatDurationClock } from '@/lib/format';
import type { VoiceProvider } from '@/providers/VoiceProvider';
import type { ActiveCall, CallState } from '@/providers/VoiceProvider';
import { Modal } from '@/components/ui/Modal';

interface CallSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  loanId: string;
  phoneNumber: string;
  operatorId: string | null;
  provider: VoiceProvider;
  title: string;
  realCall?: boolean;
  onSaved: (result: {
    callId: string;
    result: CallResult;
    durationSeconds: number;
    notes: string;
    rescheduleAt?: string;
  }) => Promise<void>;
}

type Phase = 'calling' | 'in-call' | 'result';

export function CallSimulatorModal({
  open,
  onClose,
  loanId,
  phoneNumber,
  operatorId: _operatorId,
  provider,
  title,
  realCall = false,
  onSaved,
}: CallSimulatorModalProps) {
  void _operatorId;
  const [phase, setPhase] = useState<Phase>('calling');
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<CallResult | null>(null);
  const [notes, setNotes] = useState('');
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [callId, setCallId] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    if (!open) return;
    return provider.onStateChange((state, call) => {
      setCallState(state);
      setActiveCall(call);
      if (call) {
        setCallId(call.callId);
        setDuration(call.durationSeconds);
      }
      if (state === 'ended') setPhase('result');
    });
  }, [open, provider]);

  useEffect(() => {
    if (!open || callState !== 'connected' || !activeCall?.answeredAt) return;
    const updateDuration = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - activeCall.answeredAt!.getTime()) / 1000),
      );
      setDuration(Math.max(activeCall.durationSeconds, elapsed));
    };
    updateDuration();
    const timer = setInterval(updateDuration, 1000);
    return () => clearInterval(timer);
  }, [activeCall, callState, open]);

  const startCall = async () => {
    setError('');
    try {
      const started = await provider.makeCall(loanId, phoneNumber);
      setCallId(started.callId);
      setCallState(started.state);
      setPhase('in-call');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada');
    }
  };

  const endCall = async () => {
    await provider.hangup();
    setPhase('result');
  };

  const handleSave = async () => {
    if (!result) {
      setError('Selecciona un resultado');
      return;
    }
    if (result === 'volver_a_llamar' && !rescheduleAt) {
      setError('Selecciona una nueva fecha y hora para volver a llamar');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSaved({
        callId,
        result,
        durationSeconds: duration,
        notes: notes.trim(),
        rescheduleAt: result === 'volver_a_llamar' ? rescheduleAt : undefined,
      });
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la llamada');
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setPhase('calling');
    setDuration(0);
    setResult(null);
    setNotes('');
    setRescheduleAt('');
    setError('');
    setCallId('');
    setCallState('idle');
    setActiveCall(null);
    provider.clearActiveCall();
    onClose();
  };

  const handleClose = () => {
    if (phase === 'in-call') return; // No cerrar mientras hay llamada activa
    resetAndClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="md"
      footer={
        phase === 'result' ? (
          <>
            <Button variant="secondary" onClick={resetAndClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Guardar llamada
            </Button>
          </>
        ) : phase === 'in-call' ? (
          realCall ? null : (
            <Button variant="danger" onClick={endCall}>
              <PhoneOff className="h-4 w-4" />
              Colgar
            </Button>
          )
        ) : (
          <Button onClick={startCall} loading={false}>
            <PhoneCall className="h-4 w-4" />
            Iniciar llamada
          </Button>
        )
      }
    >
      {/* Info del numero */}
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
          <Phone className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Numero destino</p>
          <p className="font-medium text-slate-900">{phoneNumber || '—'}</p>
        </div>
      </div>

      {/* Fase: llamando */}
      {phase === 'calling' && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="relative mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
              <PhoneCall className="h-10 w-10 text-indigo-600" />
            </div>
            <span className="absolute inset-0 rounded-full" style={{ animation: 'pulseRing 1.5s infinite' }} />
          </div>
          <p className="font-medium text-slate-900">Listo para llamar</p>
          <p className="mt-1 text-sm text-slate-500">
            Presiona "Iniciar llamada" para comenzar
          </p>
        </div>
      )}

      {/* Fase: en llamada */}
      {phase === 'in-call' && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="relative mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <Mic className="h-10 w-10 text-emerald-600" />
            </div>
            <span className="absolute inset-0 rounded-full" style={{ animation: 'pulseRing 1.5s infinite' }} />
          </div>
          <p className="font-medium text-slate-900">
            {realCall ? realCallStatusLabel(callState, activeCall?.providerStatus) : 'Llamada en curso'}
          </p>
          <div className="mt-2 flex items-center gap-2 text-2xl font-mono font-bold text-slate-900">
            <Clock className="h-5 w-5 text-slate-400" />
            {formatDurationClock(duration)}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {realCall
              ? activeCall?.extension
                ? `Extension ${activeCall.extension}`
                : 'Esperando novedades de Zadarma'
              : 'Presiona "Colgar" para finalizar'}
          </p>
          {realCall && callState === 'connected' && (
            <div className="mt-5 flex max-w-sm items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Si escuchas un buzón de voz, cuelga desde la extensión para evitar consumo
                innecesario.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Fase: resultado */}
      {phase === 'result' && (
        <div className="space-y-5">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Duracion</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatDurationClock(duration)}
              </span>
            </div>
            {realCall && activeCall?.providerStatus && (
              <p className="mt-1 text-xs text-slate-500">
                {terminalStatusLabel(activeCall.providerStatus)}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Resultado</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CALL_RESULTS) as CallResult[]).map((key) => {
                const cfg = CALL_RESULTS[key];
                const isSelected = result === key;
                const colorClasses: Record<string, string> = {
                  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
                  orange: 'border-orange-500 bg-orange-50 text-orange-700',
                  rose: 'border-rose-500 bg-rose-50 text-rose-700',
                  amber: 'border-amber-500 bg-amber-50 text-amber-700',
                  violet: 'border-violet-500 bg-violet-50 text-violet-700',
                };
                return (
                  <button
                    key={key}
                    onClick={() => setResult(key)}
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                      isSelected
                        ? colorClasses[cfg.color]
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {key === 'atendido' && <Phone className="h-4 w-4" />}
                    {key === 'no_contesto' && <PhoneOff className="h-4 w-4" />}
                    {key === 'buzon_voz' && <Voicemail className="h-4 w-4" />}
                    {key === 'rechazado' && <X className="h-4 w-4" />}
                    {key === 'volver_a_llamar' && <CalendarClock className="h-4 w-4" />}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {result === 'volver_a_llamar' && (
            <Input
              label="Nueva fecha y hora para llamar"
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          )}

          <Textarea
            label="Observaciones"
            rows={3}
            placeholder="Notas de la llamada..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function realCallStatusLabel(state: CallState, providerStatus?: string): string {
  if (state === 'connected') return 'Cliente conectado';
  if (state === 'ringing') return 'Operador atendió · llamando al cliente';
  if (providerStatus === 'initiated') return 'Llamando al operador';
  return 'Solicitud enviada';
}

function terminalStatusLabel(status: string): string {
  if (status === 'no_answer') return 'No contestó';
  if (status === 'busy') return 'Destino ocupado';
  if (status === 'failed') return 'La llamada falló';
  if (status === 'cancelled' || status === 'canceled') return 'Llamada cancelada';
  return 'Llamada finalizada';
}
