import type { LoanStatus, CallResult } from '@/types';

export const LOAN_STATUS: Record<
  LoanStatus,
  { label: string; color: string; dot: string; badge: string }
> = {
  nuevo: {
    label: 'Nuevo',
    color: 'text-slate-700',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  programado: {
    label: 'Programado',
    color: 'text-blue-700',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  listo_para_llamar: {
    label: 'Listo para llamar',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  llamando: {
    label: 'Llamando',
    color: 'text-indigo-700',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  atendido: {
    label: 'Atendido',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  no_contesto: {
    label: 'No contestó',
    color: 'text-orange-700',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  rechazado: {
    label: 'Rechazado',
    color: 'text-rose-700',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  finalizado: {
    label: 'Finalizado',
    color: 'text-teal-700',
    dot: 'bg-teal-500',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
};

export const STATUS_ORDER: LoanStatus[] = [
  'nuevo',
  'programado',
  'listo_para_llamar',
  'llamando',
  'atendido',
  'no_contesto',
  'rechazado',
  'finalizado',
];

export const CALL_RESULTS: Record<
  CallResult,
  { label: string; nextStatus: string; color: string; icon: string }
> = {
  atendido: {
    label: 'Atendido',
    nextStatus: 'atendido',
    color: 'emerald',
    icon: 'phone',
  },
  no_contesto: {
    label: 'No contestó',
    nextStatus: 'no_contesto',
    color: 'orange',
    icon: 'phone-off',
  },
  buzon_voz: {
    label: 'Buzón de voz',
    nextStatus: 'no_contesto',
    color: 'violet',
    icon: 'voicemail',
  },
  rechazado: {
    label: 'Rechazado',
    nextStatus: 'rechazado',
    color: 'rose',
    icon: 'x',
  },
  volver_a_llamar: {
    label: 'Volver a llamar',
    nextStatus: 'listo_para_llamar',
    color: 'amber',
    icon: 'phone-incoming',
  },
};

export const DASHBOARD_CARDS: { status: LoanStatus; label: string }[] = [
  { status: 'nuevo', label: 'Solicitudes nuevas' },
  { status: 'programado', label: 'Programadas' },
  { status: 'listo_para_llamar', label: 'Listas para llamar' },
  { status: 'llamando', label: 'Llamando' },
  { status: 'atendido', label: 'Atendidas' },
  { status: 'no_contesto', label: 'No contestó' },
  { status: 'rechazado', label: 'Rechazadas' },
  { status: 'finalizado', label: 'Finalizadas' },
];

export const PROVINCES = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];
