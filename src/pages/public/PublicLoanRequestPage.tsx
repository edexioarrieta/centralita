import { useState, type FormEvent } from 'react';
import {
  User,
  Mail,
  Phone,
  CreditCard,
  DollarSign,
  Hash,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createLoan } from '@/lib/api';
import { PROVINCES } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';

export function PublicLoanRequestPage() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    email: '',
    province: '',
    amount: '',
    installments: '12',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createLoan({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dni: form.dni.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        province: form.province,
        amount: Number(form.amount) || 0,
        installments: Number(form.installments) || 1,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return <SuccessScreen onNewRequest={() => {
      setSuccess(false);
      setForm({
        first_name: '', last_name: '', dni: '', phone: '', email: '',
        province: '', amount: '', installments: '12',
      });
    }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <span className="font-bold">P</span>
          </div>
          <span className="font-semibold text-slate-900">PrestaCRM</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
        {/* Titulo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Solicitud de prestamo</h1>
          <p className="mt-2 text-slate-500">
            Completa el formulario y un asesor te llamara a la brevedad
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              name="first_name"
              placeholder="Juan"
              icon={<User className="h-4 w-4" />}
              value={form.first_name}
              onChange={(e) => update('first_name', e.target.value)}
              required
            />
            <Input
              label="Apellido"
              name="last_name"
              placeholder="Perez"
              icon={<User className="h-4 w-4" />}
              value={form.last_name}
              onChange={(e) => update('last_name', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="DNI"
              name="dni"
              placeholder="12345678"
              icon={<CreditCard className="h-4 w-4" />}
              value={form.dni}
              onChange={(e) => update('dni', e.target.value)}
              required
            />
            <Input
              label="Telefono"
              name="phone"
              type="tel"
              placeholder="11 1234-5678"
              icon={<Phone className="h-4 w-4" />}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="juan@email.com"
              icon={<Mail className="h-4 w-4" />}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
            <Select
              label="Provincia"
              name="province"
              value={form.province}
              onChange={(e) => update('province', e.target.value)}
              required
            >
              <option value="">Selecciona...</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Capital solicitado (ARS)"
              name="amount"
              type="number"
              min="0"
              placeholder="500000"
              icon={<DollarSign className="h-4 w-4" />}
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              required
            />
            <Select
              label="Cantidad de cuotas"
              name="installments"
              value={form.installments}
              onChange={(e) => update('installments', e.target.value)}
              required
            >
              {[3, 6, 12, 18, 24, 36, 48].map((n) => (
                <option key={n} value={n}>{n} cuotas</option>
              ))}
            </Select>
          </div>

          {form.amount && Number(form.amount) > 0 && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Solicitas{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrency(Number(form.amount))}
              </span>{' '}
              en {form.installments} cuotas
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Hash className="h-4 w-4" />
                Solicitar prestamo
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Al enviar aceptas ser contactado telefonicamente por un asesor.
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({ onNewRequest }: { onNewRequest: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Solicitud recibida</h1>
        <p className="mt-3 text-slate-600">
          Tu solicitud fue recibida correctamente. Un asesor te llamara a la brevedad.
        </p>
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Proximo paso</p>
              <p className="text-sm text-slate-500">
                Te llamaremos al telefono que indicaste en unos minutos.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onNewRequest}
          className="mt-6 text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          Enviar otra solicitud
        </button>
      </div>
    </div>
  );
}
