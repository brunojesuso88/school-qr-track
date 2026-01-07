import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Settings, Scale, Wand2, Eye, Download } from 'lucide-react';
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

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/home')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{title}</h1>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 overflow-x-auto pb-2 -mb-2">
            {NAV_ITEMS.map(item => (
              <Button
                key={item.path}
                variant={isActive(item.path, item.exact) ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "whitespace-nowrap gap-2",
                  isActive(item.path, item.exact) && "bg-primary text-primary-foreground"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
};

export default TimetableLayout;
