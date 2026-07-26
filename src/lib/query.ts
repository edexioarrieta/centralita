import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: 1,
    },
  },
});

export const queryKeys = {
  loans: ['loans'] as const,
  loansByStatus: (status: string) => ['loans', 'status', status] as const,
  loan: (id: string) => ['loan', id] as const,
  calls: (loanId: string) => ['calls', loanId] as const,
  callLogs: (loanId: string) => ['callLogs', loanId] as const,
  profiles: ['profiles'] as const,
  canRegister: ['canRegister'] as const,
};

// Refresca todas las queries de loans y relacionadas
export function invalidateLoanQueries() {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
}

export function invalidateLoanDetail(loanId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.loan(loanId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.calls(loanId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.callLogs(loanId) });
}
