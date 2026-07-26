import type { LoanStatus } from '@/types';
import { LOAN_STATUS } from '@/lib/constants';

interface StatusBadgeProps {
  status: LoanStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = LOAN_STATUS[status];
  if (!cfg) return null;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.badge} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
