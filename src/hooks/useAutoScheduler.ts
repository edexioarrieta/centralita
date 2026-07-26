import { useCallback, useEffect, useRef, useState } from 'react';
import { updateLoan } from '@/lib/api';
import { invalidateLoanQueries } from '@/lib/query';
import type { Loan } from '@/types';

/**
 * Auto-scheduler que detecta prestamos en estado "nuevo" o "programado"
 * cuya fecha programada de llamada (scheduled_call_at) ya vencio, y los
 * pasa automaticamente a "listo_para_llamar".
 *
 * Hoy corre en el navegador mientras el Dashboard esta abierto.
 * La logica esta aislada para poder moverla a un proceso del servidor
 * (edge function / cron) en el futuro sin cambios en el resto del CRM.
 */
export function useAutoScheduler(loans: Loan[], enabled: boolean) {
  const [now, setNow] = useState(() => new Date());
  const processingRef = useRef<Set<string>>(new Set());

  // Tick cada segundo para actualizar la cuenta regresiva
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  // Detectar y procesar prestamos vencidos
  const processDueLoans = useCallback(async () => {
    const due = loans.filter(
      (loan) =>
        (loan.status === 'nuevo' || loan.status === 'programado') &&
        new Date(loan.scheduled_call_at).getTime() <= now.getTime() &&
        !processingRef.current.has(loan.id),
    );

    for (const loan of due) {
      processingRef.current.add(loan.id);
      try {
        await updateLoan(loan.id, { status: 'listo_para_llamar' });
      } catch {
        // Si falla, permitimos reintentar en el siguiente ciclo
        processingRef.current.delete(loan.id);
      }
    }

    if (due.length > 0) {
      invalidateLoanQueries();
    }
  }, [loans, now]);

  useEffect(() => {
    if (!enabled) return;
    processDueLoans();
  }, [processDueLoans, enabled]);

  return { now };
}
