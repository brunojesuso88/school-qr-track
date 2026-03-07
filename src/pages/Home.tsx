import { useNavigate } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { LayoutDashboard, Map, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import edunexusLogo from "@/assets/edunexus-home-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const Home = () => {
  const navigate = useNavigate();
  const { userRole, loading } = useAuth();

  const canAccessSchoolMapping = userRole === 'admin' || userRole === 'direction';

  // Professores e novos usuários (sem role) são redirecionados direto para o dashboard
  if (!loading && (userRole === 'teacher' || userRole === null)) {
    return <Navigate to="/dashboard" replace />;
  }

  const menuOptions = [
    {
      title: "Sistema de Gestão de Alunos",
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
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
