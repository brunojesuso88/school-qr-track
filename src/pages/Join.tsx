import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { clearPendingJoinToken, setPendingJoinToken } from '@/lib/schools/joinTokenStore';
import { setActiveSchoolIdStore } from '@/lib/schools/activeSchoolStore';
import { CheckCircle2, Loader2, Lock, Mail, School, ShieldAlert, User } from 'lucide-react';
import {
  registrationLinkErrorMessage,
  type ResolvedRegistrationLink,
} from '@/lib/schools/registration';

interface JoinResult {
  ok: boolean;
  status?: string;
  school_id?: string;
  already_member?: boolean;
  requires_admin_approval?: boolean;
  /** Vínculo com uma segunda escola: aprovação do administrador é obrigatória. */
  second_school?: boolean;
}

const SECOND_SCHOOL_MESSAGE =
  'Você já possui acesso a outra escola. O vínculo com uma segunda escola precisa ser aprovado pelo administrador.';

const Join = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, signUp, refreshAccess } = useAuth();

  const [link, setLink] = useState<ResolvedRegistrationLink | null>(null);
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | 'pending' | 'active'>(null);
  const [secondSchool, setSecondSchool] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('resolve_registration_link', { _token: token });
      if (cancelled) return;
      if (error) {
        setLink({ valid: false, reason: 'not_found' });
      } else {
        setLink(data as unknown as ResolvedRegistrationLink);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /**
   * Aplica o resultado do vínculo: quando o aceite é automático (status active),
   * a escola recém-vinculada já vira a escola ativa e o acesso é imediato.
   */
  const applyJoinResult = async (result: JoinResult | null) => {
    const active = result?.status === 'active';
    if (active && result?.school_id) setActiveSchoolIdStore(result.school_id);
    await refreshAccess();
    clearPendingJoinToken();
    setSecondSchool(!active && result?.second_school === true);
    setDone(active ? 'active' : 'pending');
  };

  /** Usuário já logado: apenas solicita o vínculo com a escola do token. */
  const requestMembership = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('join_school_with_token', { _token: token });
      if (error) throw error;
      const result = data as unknown as JoinResult;
      if (!result?.ok) {
        toast.error('Link inválido ou expirado.');
        return;
      }
      await applyJoinResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Informe seu nome completo');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await signUp(email.trim(), password, fullName.trim());
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este e-mail já possui conta. Entre com sua conta para concluir a solicitação.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Confirmação de e-mail: preserva o token para concluir o join após o login.
      setPendingJoinToken(token);

      // Se a sessão já existir (confirmação automática), conclui o vínculo agora.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data } = await supabase.rpc('join_school_with_token', { _token: token });
        await applyJoinResult((data ?? null) as unknown as JoinResult | null);
      } else {
        setDone('pending');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!link?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center text-center py-12 gap-3">
            <ShieldAlert className="h-12 w-12 text-destructive" />
            <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">
              {registrationLinkErrorMessage(link?.reason)}
            </p>
            <Button variant="outline" onClick={() => navigate('/auth')}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center text-center py-12 gap-3">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h1 className="text-lg font-semibold">Solicitação registrada</h1>
            <p className="text-sm text-muted-foreground">
              {done === 'active'
                ? `Seu acesso a ${link.school_name} já está liberado.`
                : secondSchool
                  ? SECOND_SCHOOL_MESSAGE
                  : `Sua solicitação de acesso a ${link.school_name} foi enviada e aguarda aprovação da gestão.`}
            </p>
            {done === 'active' && user ? (
              <Button onClick={() => navigate('/dashboard')}>Entrar no sistema</Button>
            ) : (
              <Button onClick={() => navigate('/auth')}>Ir para o login</Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <School className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{link.school_name}</CardTitle>
          <CardDescription>
            {[link.city, link.state].filter(Boolean).join(' / ') || 'Cadastro institucional'}
            <br />
            Cadastro exclusivo desta escola no EDUNEXUS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Você já está autenticado. Podemos solicitar seu vínculo com esta escola sem criar
                uma nova conta.
              </p>
              <Button className="w-full" onClick={requestMembership} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Solicitar acesso a esta escola
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="join-name"
                    className="pl-9"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="join-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="join-email"
                    type="email"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="join-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="join-password"
                    type="password"
                    className="pl-9"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta nesta escola
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setPendingJoinToken(token);
                  navigate('/auth', { state: { joinToken: token } });
                }}
              >
                Já tenho conta
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Após o cadastro, o acesso passa por aprovação da gestão da escola.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;
