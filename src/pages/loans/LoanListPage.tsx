import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye, Timer, Filter, Inbox } from 'lucide-react';
import { fetchLoans } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { LOAN_STATUS, DASHBOARD_CARDS } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  formatCurrency,
  formatDate,
  formatTime,
  countdown,
} from '@/lib/format';
import type { LoanStatus } from '@/types';
import { useAutoScheduler } from '@/hooks/useAutoScheduler';

export function LoanListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as LoanStatus | null) ?? 'all';
  const [query, setQuery] = useState('');

  const { data: allLoans = [], isLoading } = useQuery({
    queryKey: queryKeys.loans,
    queryFn: fetchLoans,
    refetchInterval: 10_000,
  });

  useAutoScheduler(allLoans, true);

  const filtered = useMemo(() => {
    let result = allLoans;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (loan) =>
          `${loan.first_name} ${loan.last_name}`.toLowerCase().includes(q) ||
          loan.dni.toLowerCase().includes(q) ||
          loan.phone.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((loan) => loan.status === statusFilter);
    }
    return result;
  }, [allLoans, query, statusFilter]);

  const setStatusFilter = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status === 'all') next.delete('status');
    else next.set('status', status);
    setSearchParams(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Prestamos</h1>
        <p className="text-sm text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'solicitud' : 'solicitudes'}
        </p>
      </div>

      {/* Buscador + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o telefono..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          <FilterChip
            label="Todos"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          {DASHBOARD_CARDS.map((card) => (
            <FilterChip
              key={card.status}
              label={LOAN_STATUS[card.status].label}
              active={statusFilter === card.status}
              onClick={() => setStatusFilter(card.status)}
            />
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <Th>Numero</Th>
                <Th>Cliente</Th>
                <Th>DNI</Th>
                <Th>Telefono</Th>
                <Th className="text-right">Capital</Th>
                <Th className="text-center">Cuotas</Th>
                <Th>Estado</Th>
                <Th>Operador</Th>
                <Th>Fecha</Th>
                <Th>Hora progr.</Th>
                <Th className="text-center">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Inbox className="h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-600">
                        No hay solicitudes que coincidan
                      </p>
                      <p className="text-xs text-slate-400">
                        Ajusta el filtro o la busqueda
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((loan) => {
                  const cd = countdown(loan.scheduled_call_at, new Date());
                  const showCountdown =
                    loan.status === 'nuevo' || loan.status === 'programado';
                  return (
                    <tr
                      key={loan.id}
                      className="group transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-medium text-slate-700">
                        {loan.loan_number}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {loan.first_name} {loan.last_name}
                        </div>
                        <div className="text-xs text-slate-400">{loan.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{loan.dni}</td>
                      <td className="px-4 py-3.5 text-slate-600">{loan.phone}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600">
                        {loan.installments}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={loan.status as LoanStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">—</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDate(loan.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        {showCountdown ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-slate-500">
                              {formatTime(loan.scheduled_call_at)}
                            </div>
                            <div
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                                cd.isOverdue
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Timer className="h-3 w-3" />
                              {cd.text}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {formatTime(loan.scheduled_call_at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center">
                          <Link
                            to={`/loans/${loan.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-900 hover:text-white"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 ${className}`}>{children}</th>;
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
