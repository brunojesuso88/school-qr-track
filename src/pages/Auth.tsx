import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, RefreshCw } from 'lucide-react';
import { clearPendingJoinToken, getPendingJoinToken } from '@/lib/schools/joinTokenStore';
import edunexusLogo from '@/assets/edunexus-new-logo.png';

const forceUpdateApp = async () => {
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    // Force reload from server
    window.location.reload();
  } catch (error) {
    window.location.reload();
  }
};

const Auth = () => {
  // Cadastro genérico REMOVIDO: novas contas existem apenas via link institucional
  // `/join/:token` da escola. Aqui só existe login + recuperação de senha.
  const isLogin = true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const { signIn, user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Modo recovery: nunca redirecionar automaticamente (evita loop e perda do token).
    if (window.location.hash.includes('type=recovery')) {
      navigate('/reset-password', { replace: true });
      return;
    }
    if (user && !loading) {
      const pending = (location.state as { joinToken?: string } | null)?.joinToken
        ?? getPendingJoinToken();
      if (pending) {
        // Conclui o vínculo escolar pendente antes de qualquer redirecionamento.
        void (async () => {
          try {
            await supabase.rpc('join_school_with_token', { _token: pending });
          } catch {
            /* token inválido/expirado: a tela /join exibe o motivo */
          } finally {
            clearPendingJoinToken();
            navigate(`/join/${pending}`, { replace: true });
          }
        })();
        return;
      }
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      if (from?.pathname && from.pathname !== '/auth') {
        navigate(`${from.pathname}${from.search ?? ''}`, { replace: true });
        return;
      }
      if (userRole === 'admin' || userRole === 'direction') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, loading, userRole, navigate, location.state]);

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = recoveryEmail.trim();
    if (!target) return;
    setSendingRecovery(true);
    // Mensagem sempre neutra: não revela se o e-mail existe.
    const neutral = 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.';
    try {
      await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      /* nunca expõe detalhes do provedor */
    } finally {
      setSendingRecovery(false);
      toast.success(neutral);
      setIsForgotOpen(false);
      setRecoveryEmail('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou senha incorretos');
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
        } else {
          toast.success('Bem-vindo de volta!');
          // Navigation will be handled by useEffect when user state updates
        }
      }
    } catch (error) {
      toast.error('Ocorreu um erro inesperado');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero relative">
      {/* Force Update Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10"
        onClick={forceUpdateApp}
        title="Forçar atualização do aplicativo"
      >
        <RefreshCw className="h-5 w-5" />
      </Button>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative animate-fade-in shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img 
              src={edunexusLogo} 
              alt="Edunexus" 
              className="h-20 w-auto mx-auto"
            />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {isLogin ? 'Log in' : 'Criar Conta'}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLogin
                ? 'Sistema digital de secretaria escolar'
                : 'Cadastre-se como administrador'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@escola.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(email);
                    setIsForgotOpen(true);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? 'Entrando...' : 'Criando conta...'}
                </>
              ) : (
                <>{isLogin ? 'Entrar' : 'Criar Conta'}</>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Novos acessos são criados apenas pelo link institucional da sua escola.
          </p>ntent>
      </Card>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado para receber o link de redefinição.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="recovery-email"
                  type="email"
                  className="pl-10"
                  placeholder="seu@email.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={sendingRecovery || !recoveryEmail.trim()}>
              {sendingRecovery && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar instruções
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;