import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { useUserFullName } from '@/hooks/useUserFullName';
import { allNavigation, NAV_GROUPS, type NavItem } from '@/lib/navigation';
import { usePermissions } from '@/contexts/PermissionsContext';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

const Dashboard = () => {
  const { userRole } = useAuth();
  const { can } = usePermissions();
  const role = userRole || 'user';
  const { fullName, loading: nameLoading } = useUserFullName();
  const { schoolName, heroUrl, loading: schoolLoading } = useSchoolProfile();

  // Permissões: reaproveita exatamente a mesma matriz de rotas/menu.
  const shortcuts: NavItem[] = allNavigation
    .filter((item) => item.href !== '/dashboard')
    .filter((item) => item.roles.includes(role))
    .filter((item) => !item.permission || can(item.permission));

  const groups = NAV_GROUPS.map((group) => ({
    group,
    items: shortcuts.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

  const infoLoading = nameLoading || schoolLoading;
  const greeting = (() => {
    if (fullName && schoolName) {
      return `Bem-vindo, ${fullName}, ao sistema de secretaria digital do ${schoolName}.`;
    }
    if (fullName) return `Bem-vindo, ${fullName}!`;
    if (schoolName) return `Bem-vindo ao sistema de secretaria digital do ${schoolName}.`;
    return 'Bem-vindo ao EDUNEXUS!';
  })();

  const hasHero = !!heroUrl;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header
          className={cn(
            'relative overflow-hidden rounded-2xl border border-border p-4 sm:p-5',
            !hasHero && 'bg-gradient-to-br from-primary/10 via-background to-accent/40',
          )}
        >
          {hasHero && (
            <>
              <img
                src={heroUrl!}
                alt={schoolName ? `Foto de destaque do ${schoolName}` : 'Foto de destaque da escola'}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50"
              />
            </>
          )}

          <div className={cn('relative', hasHero && 'text-white')}>
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                hasHero
                  ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm'
                  : 'border border-primary/30 bg-background/70 text-primary',
              )}
            >
              <Sparkles className="h-3 w-3" />
              EDUNEXUS
            </span>

            {infoLoading ? (
              <>
                <span className="mt-2 block h-5 w-4/5 max-w-xl animate-pulse rounded-md bg-current opacity-15 sm:h-6" />
                <span className="mt-2 block h-3 w-3/5 max-w-md animate-pulse rounded-md bg-current opacity-10" />
              </>
            ) : (
              <>
                <h1 className="mt-2 max-w-2xl text-balance break-words text-base font-semibold leading-snug tracking-tight sm:text-lg lg:text-xl">
                  {greeting}
                </h1>
                <p
                  className={cn(
                    'mt-1 max-w-xl text-xs',
                    hasHero ? 'text-white/85' : 'text-muted-foreground',
                  )}
                >
                  Acesso rápido aos módulos disponíveis para o seu perfil.
                </p>
              </>
            )}
          </div>
        </header>

        {groups.map(({ group, items }) => (
          <section key={group} className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-label={`${item.name} — ${item.description}`}
                  className={cn(
                    'group flex h-[128px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-center',
                    'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
                    'active:translate-y-0 active:scale-[0.99]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <span className="block text-sm font-semibold leading-tight">{item.name}</span>
                  <span className="line-clamp-2 block text-[11px] leading-tight text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {shortcuts.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum módulo disponível para o seu perfil.</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
