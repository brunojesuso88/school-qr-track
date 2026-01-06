import { useNavigate } from "react-router-dom";
import { QrCode, LayoutDashboard, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import edunexusLogo from "@/assets/edunexus-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const Home = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

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
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md space-y-0 animate-fade-in">
        {/* Logo e Nome da Escola */}
        <div className="text-center -mb-4">
          <div className="w-72 h-72 mx-auto overflow-hidden">
            <motion.img
              src={edunexusLogo}
              alt="Edunexus Logo"
              className="w-full h-full object-cover scale-125 drop-shadow-lg"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1.25 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <h1 className="text-2xl font-bold text-primary leading-tight px-4">
            Sistema digital de secretaria escolar
          </h1>
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
