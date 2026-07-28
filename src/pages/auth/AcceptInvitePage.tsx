import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export function AcceptInvitePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const savePassword = async () => {
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Validando invitación…</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Crear contraseña</h1>
        <p className="mt-1 text-sm text-slate-500">
          Completa la activación de tu cuenta de operador.
        </p>
        {!session ? (
          <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            La invitación no es válida o ha vencido. Solicita una nueva al administrador.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button className="w-full" onClick={savePassword} loading={saving}>
              Activar cuenta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
