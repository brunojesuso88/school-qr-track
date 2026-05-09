import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Calendar, Bell, Settings, Menu, X, BookOpen, LogOut, ChevronRight, ArrowLeft, Heart, FileText, Lock, RefreshCw, Download, Info, Trash2, Sun, Moon, Monitor, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AboutSystemDialog from '@/components/AboutSystemDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Alunos', href: '/students', icon: Users, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Sistema AEE', href: '/aee', icon: Heart, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Turmas', href: '/classes', icon: BookOpen, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Frequência', href: '/attendance', icon: Calendar, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Projetos', href: '/events', icon: ClipboardList, roles: ['admin', 'direction', 'teacher'] },
  { name: 'Declarações', href: '/declarations', icon: FileText, roles: ['admin', 'direction'] },
  
  { name: 'Configurações', href: '/settings', icon: Settings, roles: ['admin', 'direction'] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, userRole, isStaffOnly } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Filter navigation based on user role
  const navigation = allNavigation.filter(item => 
    item.roles.includes(userRole || 'user')
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      direction: 'Direção',
      teacher: 'Professor',
      staff: 'Funcionário',
      user: 'Usuário',
    };
    return labels[role || 'user'] || 'Usuário';
  };

  const getCurrentPageName = () => {
    const currentNav = allNavigation.find(item => item.href === location.pathname);
    return currentNav?.name || 'Dashboard';
  };

  const handleForceUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
      toast.success("Cache limpo! Recarregando...");
      setTimeout(() => { window.location.reload(); }, 500);
    } catch (error) {
      console.error("Error clearing cache:", error);
      window.location.reload();
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar");
      return;
    }
    setIsDeletingAccount(true);
    try {
      await signOut();
      toast.success("Você foi desconectado. Contate o administrador para exclusão completa da conta.");
    } catch (error: any) {
      toast.error("Erro ao processar solicitação");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <button
              onClick={() => navigate('/home')}
              className="p-2 -ml-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-sidebar-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sidebar-foreground text-sm leading-tight">Sistema de Gestão de Alunos</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestão Escolar</p>
            </div>
            <button
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                      {user?.email ? getInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60">
                      {getRoleLabel(userRole)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sidebar-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsSettingsSheetOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações da Conta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 -ml-2 text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">EDUNEXUS</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{getCurrentPageName()}</span>
            </div>

            <div className="flex-1" />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate('/notifications')}
              >
                <Bell className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Settings Sheet */}
      <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Configurações da Conta</SheetTitle>
            <SheetDescription>
              Gerencie suas preferências e conta
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* App */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Aplicativo</h4>
              <Button variant="outline" className="w-full justify-start" onClick={handleForceUpdate}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Forçar Atualização
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/install')}>
                <Download className="mr-2 h-4 w-4" />
                Instalar Aplicativo
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsAboutDialogOpen(true)}>
                <Info className="mr-2 h-4 w-4" />
                Sobre o Sistema
              </Button>
            </div>

            <Separator />

            {/* Theme */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tema</h4>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col h-auto py-3 gap-1"
                    onClick={() => setTheme(option.value)}
                  >
                    <option.icon className="h-4 w-4" />
                    <span className="text-xs">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Profile */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Perfil</h4>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                <span className="text-sm truncate">{user?.email}</span>
              </div>
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsPasswordDialogOpen(true)}>
                <Lock className="mr-2 h-4 w-4" />
                Alterar Senha
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Conta
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite sua nova senha abaixo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword}>{isUpdatingPassword ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Conta</DialogTitle>
            <DialogDescription>Esta ação é irreversível. Digite EXCLUIR para confirmar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">Confirmação</Label>
              <Input id="deleteConfirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="Digite EXCLUIR" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeletingAccount || deleteConfirmation !== "EXCLUIR"}>
              {isDeletingAccount ? "Excluindo..." : "Excluir Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <AboutSystemDialog open={isAboutDialogOpen} onOpenChange={setIsAboutDialogOpen} />
    </div>
  );
};

export default DashboardLayout;
