import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';
import { AuthProvider } from '@/context/AuthContext';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { LoanListPage } from '@/pages/loans/LoanListPage';
import { LoanDetailPage } from '@/pages/loans/LoanDetailPage';
import { PublicLoanRequestPage } from '@/pages/public/PublicLoanRequestPage';
import { OperatorsPage } from '@/pages/admin/OperatorsPage';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rutas publicas */}
            <Route path="/solicitar" element={<PublicLoanRequestPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <SignupPage />
                </PublicOnlyRoute>
              }
            />

            {/* Rutas protegidas (CRM interno) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/loans" element={<LoanListPage />} />
              <Route path="/loans/:id" element={<LoanDetailPage />} />
              <Route
                path="/admin/operators"
                element={
                  <AdminRoute>
                    <OperatorsPage />
                  </AdminRoute>
                }
              />
            </Route>

            {/* Redirecciones */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
