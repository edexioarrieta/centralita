import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Mail, Phone, Plus, Shield, UserCheck, UserX, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchProfiles, manageOperator } from '@/lib/api';
import { queryClient, queryKeys } from '@/lib/query';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { UserProfile, UserRole } from '@/types';

interface OperatorForm {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  extension: string;
  active: boolean;
}

const emptyForm: OperatorForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'operator',
  extension: '',
  active: true,
};

export function OperatorsPage() {
  const { profile: currentProfile } = useAuth();
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<OperatorForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: operators = [], isLoading } = useQuery({
    queryKey: queryKeys.profiles,
    queryFn: fetchProfiles,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (operator: UserProfile) => {
    setEditing(operator);
    setForm({
      firstName: operator.first_name,
      lastName: operator.last_name,
      email: operator.email,
      role: operator.role,
      extension: operator.extension ?? '',
      active: operator.active,
    });
    setError('');
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !/^[0-9]{3}$/.test(form.extension)) {
      setError('Completa nombre, apellido y una extensión PBX de tres dígitos.');
      return;
    }
    if (!editing && !form.email.trim()) {
      setError('El correo electrónico es obligatorio.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await manageOperator({
        action: editing ? 'update' : 'invite',
        userId: editing?.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        extension: form.extension,
        active: form.active,
        redirectTo: `${window.location.origin}/accept-invite`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      setOpen(false);
      setSuccess(
        editing
          ? 'Operador actualizado correctamente.'
          : `Invitación enviada a ${form.email.trim()}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el operador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operadores</h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra accesos, roles y extensiones de la centralita.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo operador
        </Button>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <Users className="h-9 w-9 text-slate-300" />
            <p className="mt-2 text-sm">No hay operadores registrados.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {operators.map((operator) => (
              <div
                key={operator.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {operator.first_name} {operator.last_name}
                    </p>
                    {operator.id === currentProfile?.id && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        Tu cuenta
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        operator.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {operator.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {operator.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      Ext. {operator.extension ?? 'sin asignar'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      {operator.role === 'admin' ? 'Administrador' : 'Operador'}
                    </span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEdit(operator)}>
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        canDismiss={!saving}
        title={editing ? 'Editar operador' : 'Nuevo operador'}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Guardar cambios' : 'Enviar invitación'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            <Input
              label="Apellido"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </div>
          <Input
            label="Correo electrónico"
            type="email"
            value={form.email}
            disabled={Boolean(editing)}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Rol"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            >
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </Select>
            <Input
              label="Extensión PBX"
              inputMode="numeric"
              maxLength={3}
              placeholder="101"
              value={form.extension}
              onChange={(event) =>
                setForm({ ...form, extension: event.target.value.replace(/\D/g, '').slice(0, 3) })
              }
            />
          </div>
          {editing && (
            <button
              type="button"
              disabled={editing.id === currentProfile?.id}
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                form.active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {form.active ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
              <span>
                <strong>{form.active ? 'Operador activo' : 'Operador inactivo'}</strong>
                <span className="block font-normal">
                  {form.active ? 'Puede ingresar y realizar llamadas.' : 'No puede iniciar sesión.'}
                </span>
              </span>
            </button>
          )}
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}

