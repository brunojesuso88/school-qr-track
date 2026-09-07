import { useEffect, useMemo, useState } from 'react';
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
import {
  CheckCircle2, Clock, KeyRound, Loader2, Lock, LogIn, Mail, MailCheck, RotateCcw, School,
  ShieldAlert, User, UserCheck,
} from 'lucide-react';
import {
  membershipStateForSchool,
  registrationLinkErrorMessage,
  type ResolvedRegistrationLink,
} from '@/lib/schools/registration';
import { planSignUp } from '@/lib/schools/membershipFlow';

interface JoinResult {
  ok: boolean;
  status?: string;
  school_id?: string;
  already_member?: boolean;
  /** Vínculo inativo/recusado foi reaberto como pendente. */
  reopened?: boolean;
  requires_admin_approval?: boolean;
  /** Vínculo com uma segunda escola: aprovação do administrador é obrigatória. */
  second_school?: boolean;
}

/** Estados finais distintos após a ação do usuário. */
type DoneState =
  | { kind: 'active' }
  | { kind: 'pending'; reopened: boolean; secondSchool: boolean; alreadyPending: boolean }
  | { kind: 'confirm_email'; email: string };

const SECOND_SCHOOL_MESSAGE =
  'Você já possui acesso a outra escola. O vínculo com uma segunda escola precisa ser aprovado pelo administrador.';

const Join = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, memberships, loading: authLoading, signUp, signIn, refreshAccess, signOut } = useAuth();

  const [link, setLink] = useState<ResolvedRegistrationLink | null>(null);
  const [checking, setChecking] = useState(true);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'signup' | 'existing'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);

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
   * Foto de destaque da escola no cadastro público: o servidor valida o token e
   * assina apenas o hero daquela escola (bucket privado, path nunca vem do cliente).
   */
  useEffect(() => {
    let cancelled = false;
    if (!link?.valid) {
      setHeroUrl(null);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('join-branding', { body: { token } });
        const payload = data as { valid?: boolean; hero_url?: string | null } | null;
        if (!cancelled && payload?.valid) setHeroUrl(payload.hero_url ?? null);
      } catch {
        if (!cancelled) setHeroUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, link?.valid]);

  /** Situação REAL do vínculo da conta logada com a escola deste link. */
  const membershipState = useMemo(
    () => membershipStateForSchool(memberships, link?.school_id ?? null),
    [memberships, link?.school_id],
  );

  /**
   * Aplica o resultado do vínculo: quando o aceite é automático (status active),
   * a escola recém-vinculada já vira a escola ativa e o acesso é imediato.
   */
  const applyJoinResult = async (result: JoinResult | null) => {
    const active = result?.status === 'active';
    if (active && result?.school_id) setActiveSchoolIdStore(result.school_id);
    await refreshAccess();
    clearPendingJoinToken();
    if (active) {
      setDone({ kind: 'active' });
      return;
    }
    setDone({
      kind: 'pending',
      reopened: result?.reopened === true,
      secondSchool: result?.second_school === true,
      alreadyPending: result?.already_member === true && result?.status === 'pending',
    });
  };

  /** Executa o vínculo com a escola do token para a sessão atual (já autenticada). */
  const joinWithCurrentSession = async () => {
    const { data, error } = await supabase.rpc('join_school_with_token', { _token: token });
    if (error) throw error;
    const result = data as unknown as JoinResult;
    if (!result?.ok) {
      throw new Error('Link inválido ou expirado.');
    }
    await applyJoinResult(result);
  };

  /** Usuário já logado (sem vínculo, ou com vínculo encerrado): solicita/reabre o vínculo. */
  const requestMembership = async () => {
    setSubmitting(true);
    try {
      await joinWithCurrentSession();
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
      const result = await signUp(email.trim(), password, fullName.trim());
      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      const plan = planSignUp({ hasSession: false, accountExists: result.existingAccount });
      if (plan === 'reuse_existing_account') {
        // Conta já existe: exigir autenticação da conta existente antes do vínculo.
        // Nunca associar identidade só por conhecer o e-mail.
        setMode('existing');
        setPassword('');
        toast.info('Este e-mail já tem conta no EDUNEXUS. Entre com sua senha para solicitar o acesso.');
        return;
      }

      // Confirmação de e-mail: preserva o token para concluir o join após o login.
      setPendingJoinToken(token);

      // Se a sessão já existir (confirmação automática), conclui o vínculo agora.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await joinWithCurrentSession();
      } else {
        setDone({ kind: 'confirm_email', email: email.trim() });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  };

  /** Conta existente: autentica e SÓ ENTÃO solicita/reabre o vínculo com a escola. */
  const handleExistingLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        toast.error(
          error.message.includes('Invalid login credentials')
            ? 'E-mail ou senha incorretos. Se esqueceu a senha, use a recuperação abaixo.'
            : error.message,
        );
        return;
      }
      await joinWithCurrentSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  /** Recuperação de senha da conta existente; o token fica guardado para concluir o vínculo depois. */
  const handleRecovery = async () => {
    const target = email.trim();
    if (!target) {
      toast.error('Informe o e-mail da conta.');
      return;
    }
    setSendingRecovery(true);
    try {
      setPendingJoinToken(token);
      await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      /* nunca expõe detalhes do provedor */
    } finally {
      setSendingRecovery(false);
      toast.success('Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.');
    }
  };

  const enterSystem = () => {
    if (link?.school_id) setActiveSchoolIdStore(link.school_id);
    navigate('/dashboard', { replace: true });
  };

  const switchAccount = async () => {
    setPendingJoinToken(token);
    await signOut();
    setMode('signup');
  };

  if (checking || authLoading) {
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

  const schoolName = link.school_name ?? 'esta escola';

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center text-center py-12 gap-3">
            {done.kind === 'active' && (
              <>
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h1 className="text-lg font-semibold">Cadastro concluído — acesso liberado</h1>
                <p className="text-sm text-muted-foreground">
                  Seu vínculo com {schoolName} está ativo. Você já pode usar o sistema.
                </p>
                <Button onClick={enterSystem}>Entrar no sistema</Button>
              </>
            )}
            {done.kind === 'pending' && (
              <>
                <Clock className="h-12 w-12 text-primary" />
                <h1 className="text-lg font-semibold">
                  {done.reopened
                    ? 'Vínculo reaberto — aguardando aprovação'
                    : done.alreadyPending
                      ? 'Solicitação já registrada'
                      : 'Solicitação enviada'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {done.reopened
                    ? `Seu vínculo anterior com ${schoolName} havia sido encerrado. A nova solicitação foi registrada e aguarda aprovação da gestão.`
                    : done.secondSchool
                      ? SECOND_SCHOOL_MESSAGE
                      : done.alreadyPending
                        ? `Sua solicitação de acesso a ${schoolName} já está registrada e aguarda aprovação da gestão. Não é preciso enviar outra.`
                        : `Sua solicitação de acesso a ${schoolName} foi enviada e aguarda aprovação da gestão.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assim que a gestão aprovar, basta entrar normalmente com este mesmo e-mail.
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard', { replace: true })}>
                  Continuar
                </Button>
              </>
            )}
            {done.kind === 'confirm_email' && (
              <>
                <MailCheck className="h-12 w-12 text-primary" />
                <h1 className="text-lg font-semibold">Confirme seu e-mail</h1>
                <p className="text-sm text-muted-foreground">
                  Enviamos um link de confirmação para <strong>{done.email}</strong>. Depois de confirmar,
                  entre no sistema e o vínculo com {schoolName} será solicitado automaticamente.
                </p>
                <Button variant="outline" onClick={() => navigate('/auth')}>Ir para o login</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /** Bloco para sessão já autenticada, conforme a situação REAL do vínculo com esta escola. */
  const renderAuthenticated = () => {
    const accountLine = (
      <p className="text-xs text-muted-foreground">
        Conectado como <strong>{user?.email}</strong>.{' '}
        <button type="button" className="underline" onClick={() => { void switchAccount(); }}>
          Não é você? Sair
        </button>
      </p>
    );

    if (membershipState === 'active') {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Vínculo ativo</p>
              <p className="text-sm text-muted-foreground">
                Sua conta já tem acesso a {schoolName}. Não é necessário se cadastrar de novo.
              </p>
            </div>
          </div>
          <Button className="w-full" onClick={enterSystem}>
            <LogIn className="mr-2 h-4 w-4" />
            Entrar no sistema
          </Button>
          {accountLine}
        </div>
      );
    }

    if (membershipState === 'pending') {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Solicitação pendente</p>
              <p className="text-sm text-muted-foreground">
                Sua solicitação de acesso a {schoolName} já foi registrada e aguarda aprovação da gestão.
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" disabled={submitting} onClick={async () => {
            setSubmitting(true);
            try { await refreshAccess(); } finally { setSubmitting(false); }
          }}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verificar novamente
          </Button>
          {accountLine}
        </div>
      );
    }

    if (membershipState === 'inactive' || membershipState === 'rejected') {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Vínculo encerrado</p>
              <p className="text-sm text-muted-foreground">
                Seu vínculo anterior com {schoolName} foi {membershipState === 'rejected' ? 'recusado' : 'desativado'} pela gestão.
                Você pode solicitar acesso novamente; a solicitação passará por nova aprovação.
              </p>
            </div>
          </div>
          <Button className="w-full" onClick={requestMembership} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Solicitar acesso novamente
          </Button>
          {accountLine}
        </div>
      );
    }

    // Conta existente sem vínculo com esta escola (nunca vinculada ou vínculo removido).
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
          <User className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Conta existente sem vínculo com esta escola</p>
            <p className="text-sm text-muted-foreground">
              Sua conta será reaproveitada — nenhuma conta nova é criada. Basta solicitar o acesso a {schoolName}.
            </p>
          </div>
        </div>
        <Button className="w-full" onClick={requestMembership} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Solicitar acesso a esta escola
        </Button>
        {accountLine}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {heroUrl && (
          <img
            src={heroUrl}
            alt={`Foto de destaque da escola ${link.school_name ?? ''}`}
            className="h-40 w-full object-cover sm:h-48"
            onError={() => setHeroUrl(null)}
          />
        )}
        <CardHeader className="text-center space-y-2">
          {!heroUrl && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <School className="h-6 w-6 text-primary" />
            </div>
          )}
          <CardTitle className="text-xl">{link.school_name}</CardTitle>
          <CardDescription>
            {[link.city, link.state].filter(Boolean).join(' / ') || 'Cadastro institucional'}
            <br />
            Cadastro exclusivo desta escola no EDUNEXUS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            renderAuthenticated()
          ) : mode === 'existing' ? (
            <form onSubmit={handleExistingLogin} className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Conta já existente — entre para solicitar acesso</p>
                  <p className="text-sm text-muted-foreground">
                    Este e-mail já possui conta no EDUNEXUS. Entre com sua senha e o vínculo com {schoolName} será
                    solicitado em seguida. Nenhuma conta nova será criada.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="join-existing-email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="join-existing-email"
                    type="email"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="join-existing-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="join-existing-password"
                    type="password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar e solicitar acesso
              </Button>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-xs"
                  disabled={sendingRecovery}
                  onClick={() => { void handleRecovery(); }}
                >
                  {sendingRecovery && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Esqueci minha senha
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-xs"
                  onClick={() => { setMode('signup'); setPassword(''); }}
                >
                  Usar outro e-mail
                </Button>
              </div>
            </form>
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
                onClick={() => { setMode('existing'); setPassword(''); }}
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
