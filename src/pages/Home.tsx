import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, LayoutDashboard, Map, Settings, RefreshCw, Sun, Moon, Monitor, User, Lock, LogOut, Trash2, Clock, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import edunexusLogo from "@/assets/edunexus-home-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const Home = () => {
  const navigate = useNavigate();
  const { userRole, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const canAccessSchoolMapping = userRole === 'admin' || userRole === 'direction';

  const menuOptions = [
    {
      title: "QR Codes",
      description: "Escanear presença dos alunos",
      icon: QrCode,
      path: "/scan",
      gradient: "from-success/20 to-success/5",
      iconColor: "text-success",
      borderColor: "border-success/30",
    },
    {
      title: "Sistema de gestão de presença",
      description: "Painel de controle completo",
      icon: LayoutDashboard,
      path: "/dashboard",
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/30",
    },
    ...(canAccessSchoolMapping ? [{
      title: "Mapeamento Escolar",
      description: "Distribuição de professores e turmas",
      icon: Map,
      path: "/school-mapping",
      gradient: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/30",
    }] : []),
    ...(canAccessSchoolMapping ? [{
      title: "Criação do Horário",
      description: "Geração automática com IA",
      icon: Clock,
      path: "/timetable",
      gradient: "from-violet-500/20 to-violet-500/5",
      iconColor: "text-violet-500",
      borderColor: "border-violet-500/30",
    }] : []),
  ];

  const handleForceUpdate = async () => {
    try {
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
      
      toast.success("Cache limpo! Recarregando...");
      setTimeout(() => {
        window.location.reload();
      }, 500);
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
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
      // Note: Full account deletion typically requires admin privileges
      // For now, we'll sign out the user and show a message
      await signOut();
      toast.success("Você foi desconectado. Contate o administrador para exclusão completa da conta.");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Erro ao processar solicitação");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Settings Button */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 rounded-full"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Configurações</SheetTitle>
            <SheetDescription>
              Gerencie suas preferências e conta
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Force Update & Install */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Aplicativo</h4>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleForceUpdate}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Forçar Atualização
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/install')}
              >
                <Download className="mr-2 h-4 w-4" />
                Instalar Aplicativo
              </Button>
            </div>

            <Separator />

            {/* Theme Options */}
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

            {/* Profile Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Perfil</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{user?.email}</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsPasswordDialogOpen(true)}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Conta
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua nova senha abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os seus dados serão perdidos.
              Digite EXCLUIR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">Confirmação</Label>
              <Input
                id="deleteConfirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digite EXCLUIR"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount} 
              disabled={isDeletingAccount || deleteConfirmation !== "EXCLUIR"}
            >
              {isDeletingAccount ? "Excluindo..." : "Excluir Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-lg space-y-0 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.img
            src={edunexusLogo}
            alt="Edunexus"
            className="w-full max-w-lg mx-auto drop-shadow-xl"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <motion.p 
            className="text-foreground text-base font-semibold mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Sistema Digital de Secretaria Escolar
          </motion.p>
        </div>

        {/* Menu Options */}
        <div className="grid gap-4">
          {menuOptions.map((option) => (
            <Card
              key={option.path}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-2 ${option.borderColor} bg-gradient-to-r ${option.gradient}`}
              onClick={() => navigate(option.path)}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`p-4 rounded-xl bg-background/80 shadow-sm ${option.iconColor}`}>
                  <option.icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {option.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <div className="text-muted-foreground/50">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Edunexus - Todos os direitos reservados
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Criado e desenvolvido por Bruno Oliveira
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
