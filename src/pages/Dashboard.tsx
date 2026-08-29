import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { allNavigation, NAV_GROUPS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ArrowRight, LayoutDashboard } from 'lucide-react';

const Dashboard = () => {
  const { userRole, user } = useAuth();

  const shortcuts = allNavigation.filter(
    (item) => item.href !== '/dashboard' && item.roles.includes(userRole || 'user')
  );

  const groups = NAV_GROUPS
    .map((group) => ({ group, items: shortcuts.filter((item) => item.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Painel Inicial
          </h1>
          <p className="text-muted-foreground">
            {user?.email?.split('@')[0]
              ? `Olá, ${user.email.split('@')[0]}. Escolha uma área para começar.`
              : 'Escolha uma área para começar.'}
          </p>
        </header>

        {groups.map(({ group, items }) => (
          <section key={group} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-label={`${item.name} — ${item.description}`}
                  className={cn(
                    'group relative flex items-start gap-4 rounded-xl border border-border bg-card p-4 sm:p-5',
                    'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  )}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold leading-tight">{item.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum módulo disponível para o seu perfil.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
