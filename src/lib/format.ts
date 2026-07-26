export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function formatDurationClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function toLocalDatetimeInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function countdown(targetIso: string, now: Date = new Date()): {
  text: string;
  isOverdue: boolean;
  seconds: number;
} {
  const target = new Date(targetIso).getTime();
  const diff = target - now.getTime();
  if (diff <= 0) {
    return { text: 'Listo para llamar', isOverdue: true, seconds: 0 };
  }
  const seconds = Math.floor(diff / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return {
    text: `${m}m ${s.toString().padStart(2, '0')}s`,
    isOverdue: false,
    seconds,
  };
}

export function getInitials(first?: string, last?: string): string {
  const a = (first || '').trim().charAt(0).toUpperCase();
  const b = (last || '').trim().charAt(0).toUpperCase();
  return (a + b) || '?';
}

export function fullName(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(' ').trim() || '—';
}
