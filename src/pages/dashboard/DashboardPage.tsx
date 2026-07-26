import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Inbox,
  Clock,
  PhoneCall,
  Phone,
  PhoneOff,
  XCircle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Timer,
} from 'lucide-react';
import { fetchLoans } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { LOAN_STATUS, DASHBOARD_CARDS, STATUS_ORDER } from '@/lib/constants';
import type { LoanStatus } from '@/types';
import { useAutoScheduler } from '@/hooks/useAutoScheduler';
import { formatDateTime, countdown } from '@/lib/format';

const cardIcons: Record<LoanStatus, typeof Inbox> = {
  nuevo: Inbox,
  programado: Clock,
  listo_para_llamar: Timer,
  llamando: PhoneCall,
  atendido: CheckCircle2,
  no_contesto: PhoneOff,
  rechazado: XCircle,
  finalizado: CheckCircle2,
};

export function DashboardPage() {
  const { data: loans = [], isLoading } = useQuery({
    queryKey: queryKeys.loans,
    queryFn: fetchLoans,
    refetchInterval: 10_000,
  });

  useAutoScheduler(loans, true);

  const counts = useMemo(() => {
    const map = {} as Record<LoanStatus, number>;
    for (const status of STATUS_ORDER) map[status] = 0;
    for (const loan of loans) {
      if (map[loan.status] !== undefined) map[loan.status]++;
    }
    return map;
  }, [loans]);

  const total = loans.length;
  const maxCount = Math.max(1, ...Object.values(counts));

  const upcoming = useMemo(
    () =>
      loans
        .filter((l) => l.status === 'nuevo' || l.status === 'programado')
        .sort((a, b) => new Date(a.scheduled_call_at).getTime() - new Date(b.scheduled_call_at).getTime())
        .slice(0, 5),
    [loans],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen de solicitudes y estado del pipeline de llamadas
        </p>
      </div>

      {/* Tarjetas de estado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DASHBOARD_CARDS.map((card) => {
          const cfg = LOAN_STATUS[card.status];
          const count = counts[card.status] ?? 0;
          const Icon = cardIcons[card.status];
          return (
            <Link
              key={card.status}
              to={`/loans?status=${card.status}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.badge}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Grafico + Proximas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Grafico por estado */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Distribucion por estado</h2>
              <p className="text-sm text-slate-500">{total} solicitudes en total</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const cfg = LOAN_STATUS[status];
              const count = counts[status] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              const widthPct = (count / maxCount) * 100;
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="text-sm text-slate-600">{cfg.label}</span>
                  </div>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-md ${cfg.dot} transition-all duration-500`}
                      style={{ width: `${Math.max(widthPct, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                    <span className="text-xs text-slate-400">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Proximas llamadas */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Proximas llamadas</h2>
            <Phone className="h-5 w-5 text-slate-400" />
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Phone className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No hay llamadas programadas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((loan) => {
                const cd = countdown(loan.scheduled_call_at, new Date());
                return (
                  <Link
                    key={loan.id}
                    to={`/loans/${loan.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {loan.first_name} {loan.last_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {loan.loan_number} · {formatDateTime(loan.scheduled_call_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        cd.isOverdue
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cd.text}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Acceso rapido */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold text-slate-900">Listado completo</h2>
          <p className="text-sm text-slate-500">Ver y gestionar todas las solicitudes</p>
        </div>
        <Link
          to="/loans"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Ver prestamos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
