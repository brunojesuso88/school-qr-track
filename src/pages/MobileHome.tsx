import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { QrCode, Search } from "lucide-react";
import edunexusLogo from "@/assets/edunexus-logo.png";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

const MobileHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const menuOptions = [
    {
      title: "Escanear QR",
      description: "Registrar presença de alunos",
      icon: QrCode,
      path: "/mobile/scan",
      gradient: "from-primary to-primary/80",
    },
    {
      title: "Consultar Aluno",
      description: "Buscar informações do aluno",
      icon: Search,
      path: "/mobile/student-lookup",
      gradient: "from-success to-success/80",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-3">
            <img
              src={edunexusLogo}
              alt="Edunexus"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">Edunexus</h1>
              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                {user?.email}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Welcome Card */}
        <Card className="mb-6 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-5">
            <h2 className="text-xl font-semibold mb-1">Olá! 👋</h2>
            <p className="text-primary-foreground/80 text-sm">
              O que você deseja fazer hoje?
            </p>
          </CardContent>
        </Card>

        {/* Menu Cards */}
        <div className="space-y-4">
          {menuOptions.map((option) => (
            <Card
              key={option.path}
              className="cursor-pointer card-hover overflow-hidden"
              onClick={() => navigate(option.path)}
            >
              <CardContent className="p-0">
                <div className="flex items-center">
                  <div className={`bg-gradient-to-br ${option.gradient} p-5 flex items-center justify-center`}>
                    <option.icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div className="flex-1 p-4">
                    <CardTitle className="text-base mb-1">{option.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {option.description}
                    </CardDescription>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default MobileHome;