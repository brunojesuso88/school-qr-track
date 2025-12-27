import { useNavigate } from "react-router-dom";
import { QrCode, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import edunexusLogo from "@/assets/edunexus-logo.png";
import { useSchoolName } from "@/hooks/useSchoolName";

const Home = () => {
  const navigate = useNavigate();
  const { schoolName } = useSchoolName();

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
      title: "Dashboard",
      description: "Painel de controle completo",
      icon: LayoutDashboard,
      path: "/dashboard",
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/30",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo e Nome da Escola */}
        <div className="text-center">
          <img
            src={edunexusLogo}
            alt="Edunexus Logo"
            className="w-64 h-64 object-contain mx-auto drop-shadow-lg"
          />
          {schoolName && (
            <h1 className="mt-4 text-xl font-bold text-foreground leading-tight px-4">
              {schoolName}
            </h1>
          )}
          <p className="mt-2 text-muted-foreground text-sm">
            Sistema de Gestão de Presença
          </p>
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
        <p className="text-center text-xs text-muted-foreground/60 mt-8">
          © {new Date().getFullYear()} Edunexus - Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default Home;
