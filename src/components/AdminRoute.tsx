import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { PermissionKey } from '@/lib/permissions/catalog';
import { describeAccountAccess, extractJoinToken } from '@/lib/schools/registration';
import { getPendingJoinToken } from '@/lib/schools/joinTokenStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Link2, Loader2, RotateCcw, School } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  /** Permissão escolar exigida para abrir a rota (bloqueia URL direta). */
  permission?: PermissionKey;
}

const Dots = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  </div>
);

/**
 * Conta autenticada SEM acesso escolar: nunca prende o usuário. Mostra a situação
 * real (pendente / encerrado / sem vínculo) e um caminho para o link de cadastro.
 */
const NoSchoolAccess = () => {
  const { memberships, refreshAccess, signOut } = useAuth();
  const navigate = useNavigate();
  const [rechecking, setRechecking] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const state = describeAccountAccess(memberships);
  const closedSchools = memberships
    .filter((m) => m.status === 'inactive' || m.status === 'rejected')
    .map((m) => m.school_name);

  const recheck = async () => {
    setRechecking(true);
    try {
      await refreshAccess();
    } finally {
      setRechecking(false);
    }
  };

  const openJoinLink = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractJoinToken(joinInput);
    if (!token) {
      setJoinError('Link não reconhecido. Cole o link completo de cadastro enviado pela escola.');
      return;
    }
    setJoinError(null);
    navigate(`/join/${token}`);
  };

  const title = state === 'pending'
    ? 'Acesso aguardando aprovação'
    : state === 'closed'
      ? 'Vínculo encerrado'
      : 'Conta sem vínculo escolar';

  const description = state === 'pending'
    ? 'Seu cadastro foi recebido e está aguardando aprovação da gestão da escola. Assim que for aprovado, basta entrar novamente.'
    : state === 'closed'
      ? `Seu acesso ${closedSchools.length === 1 ? `a ${closedSchools[0]}` : 'às escolas anteriores'} foi encerrado pela gestão. Para solicitar acesso novamente, abra o link de cadastro da escola — sua conta será reaproveitada.`
      : 'Sua conta existe, mas não está vinculada a nenhuma escola. Abra o link exclusivo de cadastro da sua escola para solicitar o acesso — não é preciso criar outra conta.';

  const Icon = state === 'pending' ? Clock : state === 'closed' ? RotateCcw : School;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {state !== 'pending' && (
          <form onSubmit={openJoinLink} className="space-y-2">
            <Label htmlFor="join-link-input" className="text-xs">Link de cadastro da escola</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="join-link-input"
                  className="pl-9"
                  placeholder="https://…/join/…"
                  value={joinInput}
                  onChange={(e) => { setJoinInput(e.target.value); setJoinError(null); }}
                  autoComplete="off"
                />
              </div>
              <Button type="submit">Abrir</Button>
            </div>
            {joinError && <p className="text-xs text-destructive">{joinError}</p>}
          </form>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-primary underline"
            disabled={rechecking}
            onClick={() => { void recheck(); }}
          >
            {rechecking && <Loader2 className="h-3 w-3 animate-spin" />}
            Verificar acesso novamente
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline"
            onClick={() => { void signOut(); }}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminRoute = ({ children, permission }: AdminRouteProps) => {
  const { user, loading, isDashboardUser, isStaffOnly, hasSchoolAccess } = useAuth();
  const { can, loading: permissionsLoading } = usePermissions();
  const location = useLocation();

  if (loading) return <Dots />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!hasSchoolAccess) {
    // Cadastro por link interrompido (ex.: confirmação de e-mail ou troca de conta):
    // volta direto ao link para concluir a solicitação de vínculo.
    const pendingToken = getPendingJoinToken();
    if (pendingToken && !location.pathname.startsWith('/join/')) {
      return <Navigate to={`/join/${pendingToken}`} replace />;
    }
    return <NoSchoolAccess />;
  }

  // Funcionário vai para página simplificada de QR
  if (isStaffOnly) {
    return <Navigate to="/staff/scan" replace />;
  }

  // Apenas usuários do dashboard (admin, direção, professor) podem acessar
  if (!isDashboardUser) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (permission) {
    if (permissionsLoading) return <Dots />;
    if (!can(permission)) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
