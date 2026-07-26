import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, ArrowRight, Ban } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { canRegisterFirstUser } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { AuthShell } from '@/pages/auth/LoginPage';

export function SignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Gate: solo se puede registrar si no existe ningun operador
  const { data: canRegister, isLoading: checkingGate } = useQuery({
    queryKey: queryKeys.canRegister,
    queryFn: canRegisterFirstUser,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: 'admin', // El primer operador es admin
          },
        },
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('No se pudo crear la cuenta');

      // El trigger handle_new_user crea el perfil automaticamente
      navigate('/login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear la cuenta';
      setError(
        msg.includes('already registered')
          ? 'Ya existe una cuenta con ese email'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingGate) {
    return (
      <AuthShell title="Registro" subtitle="Verificando disponibilidad...">
        <div className="flex items-center justify-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </AuthShell>
    );
  }

  if (canRegister === false) {
    return (
      <AuthShell title="Registro no disponible" subtitle="">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Ban className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">El registro publico esta deshabilitado</p>
              <p className="mt-1 text-amber-700">
                Ya existe un operador registrado. Los nuevos operadores deben ser creados
                por un administrador desde el CRM o directamente en Supabase.
              </p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              Ir al inicio de sesion
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crear el primer operador"
      subtitle="Esta cuenta sera el administrador del CRM"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombre"
            name="first_name"
            placeholder="Juan"
            icon={<User className="h-4 w-4" />}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Apellido"
            name="last_name"
            placeholder="Perez"
            icon={<User className="h-4 w-4" />}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="admin@empresa.com"
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
          placeholder="Minimo 6 caracteres"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          Esta cuenta tendra rol de administrador. Una vez creada, el registro publico
          quedara deshabilitado.
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Crear operador
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link
          to="/login"
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          Iniciar sesion
        </Link>
      </p>
    </AuthShell>
  );
}
