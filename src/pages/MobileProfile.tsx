import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Mail, Shield, Download } from "lucide-react";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

const MobileProfile = () => {
  const navigate = useNavigate();
  const { user, signOut, userRole } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      teacher: "Professor",
      staff: "Funcionário",
      user: "Usuário",
    };
    return labels[role || "user"] || "Usuário";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
          <ThemeToggle />
        </div>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {user?.email ? getInitials(user.email) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold text-lg">{user?.email?.split("@")[0]}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-sm truncate">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-success/10 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Função</p>
                <p className="font-medium text-sm">{getRoleLabel(userRole)}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer card-hover"
            onClick={() => navigate("/install")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-accent p-2 rounded-lg">
                <Download className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Instalar Aplicativo</p>
                <p className="text-xs text-muted-foreground">Adicione à tela inicial</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sign Out Button */}
        <Button
          variant="destructive"
          className="w-full mt-6"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da Conta
        </Button>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default MobileProfile;