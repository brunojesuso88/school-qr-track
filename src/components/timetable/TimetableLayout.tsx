import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChevronLeft, Settings, Scale, Wand2, Eye, Download, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimetableLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const NAV_ITEMS = [
  { path: '/timetable', label: 'Visão Geral', icon: Eye, exact: true },
  { path: '/timetable/settings', label: 'Configurações', icon: Settings },
  { path: '/timetable/rules', label: 'Regras', icon: Scale },
  { path: '/timetable/generate', label: 'Gerar', icon: Wand2 },
  { path: '/timetable/export', label: 'Exportar', icon: Download }
];

const TimetableLayout = ({ children, title, description }: TimetableLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const SidebarContent = () => (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map(item => (
        <Button
          key={item.path}
          variant={isActive(item.path, item.exact) ? 'default' : 'ghost'}
          className={cn(
            "justify-start gap-3 h-11",
            isActive(item.path, item.exact) && "bg-primary text-primary-foreground"
          )}
          onClick={() => handleNavigate(item.path)}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </Button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-card/50">
        <div className="flex items-center gap-3 p-4 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/home')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold text-sm">Criação do Horário</h2>
            <p className="text-xs text-muted-foreground">Geração automática com IA</p>
          </div>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 p-4">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex items-center gap-3 p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { navigate('/home'); setSidebarOpen(false); }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h2 className="font-semibold text-sm">Criação do Horário</h2>
                    <p className="text-xs text-muted-foreground">Geração automática com IA</p>
                  </div>
                </div>
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
              {description && (
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              )}
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:block border-b bg-card/50">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default TimetableLayout;
