import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Grid3X3, 
  FileText,
  Menu, 
  X, 
  ArrowLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoEscola from "@/assets/logo-escola.jpg";

const navigation = [
  { name: 'Visão Geral', href: '/school-mapping', icon: LayoutDashboard },
  { name: 'Professores', href: '/school-mapping/teachers', icon: Users },
  { name: 'Disciplinas', href: '/school-mapping/subjects', icon: BookOpen },
  { name: 'Turmas', href: '/school-mapping/classes', icon: GraduationCap },
  { name: 'Distribuição', href: '/school-mapping/distribution', icon: Grid3X3 },
  { name: 'Resumo', href: '/school-mapping/summary', icon: FileText },
];

interface SchoolMappingLayoutProps {
  children: React.ReactNode;
}

const SchoolMappingLayout: React.FC<SchoolMappingLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, userRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getCurrentPageName = () => {
    const currentNav = navigation.find(item => item.href === location.pathname);
    return currentNav?.name || 'Mapeamento Escolar';
  };

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
          {/* Header with Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <button
              onClick={() => navigate('/home')}
              className="p-2 -ml-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-sidebar-foreground" />
            </button>
            <img 
              src={logoEscola} 
              alt="Logo CEPANS" 
              className="w-10 h-10 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sidebar-foreground text-sm leading-tight truncate">Mapeamento Escolar</h1>
              <p className="text-xs text-sidebar-foreground/60">Distribuição de Professores</p>
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
                  <div className="flex-1 text-left min-w-0">
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
              <span className="text-muted-foreground">Mapeamento</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{getCurrentPageName()}</span>
            </div>

            <div className="flex-1" />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default SchoolMappingLayout;
