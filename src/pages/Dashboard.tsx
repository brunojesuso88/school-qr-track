import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { useUserFullName } from '@/hooks/useUserFullName';
import { allNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ArrowRight, Users, Heart, BookOpen, ClipboardList, CalendarDays, Calendar, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface HighlightCard {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Classe do bloco de ícone (tokens semânticos). */
  accent: string;
  /** Card em destaque no grid do desktop. */
  wide?: boolean;
}

const HIGHLIGHTS: HighlightCard[] = [
  {
    name: 'Alunos',
    href: '/students',
    icon: Users,
    description: 'Cadastros, notas, IRA, ocorrências e acompanhamento dos estudantes.',
    accent: 'bg-primary/10 text-primary',
    wide: true,
  },
  {
    name: 'Sistema AEE',
    href: '/aee',
    icon: Heart,
    description: 'PEI, PAEE e acompanhamento educacional especializado.',
    accent: 'bg-accent text-accent-foreground',
  },
  {
    name: 'Turmas',
    href: '/classes',
    icon: BookOpen,
    description: 'Organize turmas, estudantes, disciplinas e informações acadêmicas.',
    accent: 'bg-secondary text-secondary-foreground',
  },
  {
    name: 'Frequências',
    href: '/attendance',
    icon: Calendar,
    description: 'Realize a frequência diária, acompanhe turmas pendentes e consulte registros e relatórios.',
    accent: 'bg-primary/10 text-primary',
  },
  {
    name: 'Projetos',
    href: '/events',
    icon: ClipboardList,
    description: 'Planeje, acompanhe e registre projetos desenvolvidos pela escola.',
    accent: 'bg-primary/10 text-primary',
  },
  {
    name: 'Eventos',
    href: '/school-events',
    icon: CalendarDays,
    description: 'Organize eventos, atas, registros e ações da comunidade escolar.',
    accent: 'bg-accent text-accent-foreground',
    wide: true,
  },
];

const Dashboard = () => {
  const { userRole } = useAuth();
  const role = userRole || 'user';
  const { fullName, loading: nameLoading } = useUserFullName();
  const { schoolName, heroUrl, loading: schoolLoading } = useSchoolProfile();

  // Permissões: reaproveita exatamente a mesma matriz de rotas/menu.
  const allowedHrefs = new Set(
    allNavigation.filter((item) => item.roles.includes(role)).map((item) => item.href),
  );
  const cards = HIGHLIGHTS.filter((card) => allowedHrefs.has(card.href));

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
      <div className="space-y-8">
        <header
          className={cn(
            'relative overflow-hidden rounded-2xl border border-border p-6 sm:p-10',
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
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
                hasHero
                  ? 'border border-white/40 bg-white/15 text-white backdrop-blur-sm'
                  : 'border border-primary/30 bg-background/70 text-primary',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              EDUNEXUS
            </span>

            {infoLoading ? (
              <>
                <span className="mt-4 block h-8 w-4/5 max-w-xl animate-pulse rounded-md bg-current opacity-15 sm:h-10" />
                <span className="mt-3 block h-4 w-3/5 max-w-md animate-pulse rounded-md bg-current opacity-10" />
              </>
            ) : (
              <>
                <h1 className="mt-3 max-w-2xl text-balance break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl lg:text-3xl">
                  {greeting}
                </h1>
                <p
                  className={cn(
                    'mt-1.5 max-w-xl text-xs sm:text-sm',
                    hasHero ? 'text-white/85' : 'text-muted-foreground',
                  )}
                >
                  Escolha uma área abaixo para começar a gestão pedagógica da escola.
                </p>
              </>
            )}
          </div>
        </header>


        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              aria-label={`${card.name} — ${card.description}`}
              className={cn(
                'group relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6',
                'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl',
                'active:translate-y-0 active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                card.wide && 'lg:col-span-2',
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <span
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3',
                  card.accent,
                )}
              >
                <card.icon className="h-8 w-8" />
              </span>
              <span className="mt-5 block">
                <span className="block text-xl font-semibold leading-tight">{card.name}</span>
                <span className="mt-1.5 block text-sm text-muted-foreground">{card.description}</span>
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Acessar
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>

        {cards.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum módulo disponível para o seu perfil.</p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
