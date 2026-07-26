import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesion';
      setError(
        msg.includes('Invalid login')
          ? 'Email o contrasena incorrectos'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesion" subtitle="Accede al panel del CRM">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="operador@empresa.com"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Contrasena"
          type="password"
          name="password"
          placeholder="••••••••"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Ingresar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Todavia no hay operadores?{' '}
        <Link
          to="/signup"
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          Crear el primer operador
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
      {/* Panel decorativo */}
      <div className="relative hidden lg:flex lg:flex-col lg:justify-between overflow-hidden bg-slate-900 p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2.5 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <span className="text-xl font-bold">P</span>
            </div>
            <span className="text-lg font-semibold">PrestaCRM</span>
          </div>
        </div>

        <div className="relative space-y-6 text-white">
          <h1 className="text-3xl font-bold leading-tight">
            Gestion de solicitudes de prestamos personales
          </h1>
          <p className="text-slate-300 leading-relaxed">
           Desde la solicitud del cliente hasta la llamada telefonica, todo en un solo lugar.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Solicitud', 'Programacion', 'Llamada', 'Resultado'].map((step, i) => (
              <span
                key={step}
                className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200 backdrop-blur"
              >
                {i + 1}. {step}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-slate-400">CRM para empresas de prestamos</p>
      </div>

      {/* Formulario */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <span className="text-xl font-bold">P</span>
            </div>
            <span className="text-lg font-semibold text-slate-900">PrestaCRM</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
