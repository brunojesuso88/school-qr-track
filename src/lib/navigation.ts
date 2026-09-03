import {
  LayoutDashboard, Users, Calendar, BookOpen, Heart, FileText, ClipboardList,
  CalendarDays, FileWarning, GraduationCap, Library, Settings, Calculator, Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PermissionKey } from '@/lib/permissions/catalog';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  group: string;
  /** Legenda curta exibida nos atalhos do Painel Inicial. */
  description: string;
  /** Itens apenas de atalho (não aparecem na sidebar). */
  shortcutOnly?: boolean;
  /** Permissão escolar exigida (além do papel) para ver e abrir o módulo. */
  permission?: PermissionKey;
}

export const NAV_GROUPS = ['Visão Geral', 'Secretaria', 'Projetos e Eventos', 'Documentos', 'Sistema'];

export const allNavigation: NavItem[] = [
  { name: 'Painel Inicial', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'direction', 'teacher'], group: 'Visão Geral', description: 'Acesso rápido a todas as áreas do sistema' },
  { name: 'Alunos', href: '/students', icon: Users, roles: ['admin', 'direction', 'teacher'], group: 'Secretaria', description: 'Cadastro, ocorrências, notas e atestados', permission: 'students.view' },
  { name: 'Sistema AEE', href: '/aee', icon: Heart, roles: ['admin', 'direction', 'teacher'], group: 'Secretaria', description: 'Atendimento educacional especializado', permission: 'aee.view' },
  { name: 'Turmas', href: '/classes', icon: BookOpen, roles: ['admin', 'direction', 'teacher'], group: 'Secretaria', description: 'Turmas, séries e importação de boletins', permission: 'classes.view' },
  { name: 'Professores', href: '/teachers', icon: GraduationCap, roles: ['admin', 'direction'], group: 'Secretaria', description: 'Corpo docente e disponibilidade', permission: 'teachers.view' },
  { name: 'Disciplinas', href: '/subjects', icon: Library, roles: ['admin', 'direction'], group: 'Secretaria', description: 'Matriz curricular oficial por série', permission: 'subjects.view' },
  { name: 'IRA', href: '/ira', icon: Calculator, roles: ['admin', 'direction'], group: 'Secretaria', description: 'Pesos, períodos e classificação do IRA', permission: 'ira.view' },
  { name: 'Frequência', href: '/attendance', icon: Calendar, roles: ['admin', 'direction', 'teacher'], group: 'Secretaria', description: 'Presenças, faltas e relatórios diários', permission: 'attendance.view' },
  { name: 'Projetos', href: '/events', icon: ClipboardList, roles: ['admin', 'direction', 'teacher'], group: 'Projetos e Eventos', description: 'Projetos pedagógicos da escola', permission: 'projects.view' },
  { name: 'Eventos', href: '/school-events', icon: CalendarDays, roles: ['admin', 'direction', 'teacher'], group: 'Projetos e Eventos', description: 'Calendário e divulgação de eventos', permission: 'events.view' },
  { name: 'Declarações', href: '/declarations', icon: FileText, roles: ['admin', 'direction'], group: 'Documentos', description: 'Emissão de declarações escolares', permission: 'declarations.access' },
  { name: 'Notificação Docente', href: '/teacher-notifications', icon: FileWarning, roles: ['admin', 'direction'], group: 'Documentos', description: 'Notificações formais para professores', permission: 'teacher_notifications.access' },
  { name: 'Configurações', href: '/settings', icon: Settings, roles: ['admin', 'direction'], group: 'Sistema', description: 'Escola, usuários e dados' },
  { name: 'Notificações', href: '/notifications', icon: Bell, roles: ['admin', 'direction', 'teacher'], group: 'Sistema', description: 'Central de avisos e alertas do sistema', permission: 'notifications.access', shortcutOnly: true },
];

export const sidebarNavigation = allNavigation.filter((item) => !item.shortcutOnly);
