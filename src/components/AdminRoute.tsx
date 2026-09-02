import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading, isDashboardUser, isStaffOnly, hasSchoolAccess, awaitingApproval, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Conta criada por link de escola, ainda sem aprovação da gestão
  if (!hasSchoolAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center space-y-3">
          <h1 className="text-lg font-semibold">
            {awaitingApproval ? 'Acesso aguardando aprovação' : 'Sem acesso escolar'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {awaitingApproval
              ? 'Seu cadastro foi recebido e está aguardando aprovação da gestão da escola.'
              : 'Sua conta ainda não está vinculada a nenhuma escola. Solicite à gestão o link exclusivo de cadastro da sua escola.'}
          </p>
          <button
            className="text-sm text-primary underline"
            onClick={() => { void signOut(); }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  // Funcionário vai para página simplificada de QR
  if (isStaffOnly) {
    return <Navigate to="/staff/scan" replace />;
  }

  // Apenas usuários do dashboard (admin, direção, professor) podem acessar
  if (!isDashboardUser) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default AdminRoute;
