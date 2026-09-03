/**
 * Catálogo único de permissões escolares.
 *
 * Espelha `public.role_permission_defaults` no banco. O banco continua sendo a
 * fonte da verdade da autorização (`has_school_permission`); este catálogo
 * existe para tipar as chaves no frontend e organizar a UI.
 */

export type PermissionKey =
  | 'students.view' | 'students.create' | 'students.edit' | 'students.delete'
  | 'occurrences.view' | 'occurrences.create' | 'occurrences.edit' | 'occurrences.delete'
  | 'grades.view' | 'grades.manage'
  | 'medical_certificates.manage'
  | 'classes.view' | 'classes.create' | 'classes.edit' | 'classes.delete'
  | 'classes.import_report_card'
  | 'attendance.view' | 'attendance.record' | 'attendance.edit' | 'attendance.delete'
  | 'aee.view' | 'aee.manage'
  | 'teachers.view' | 'teachers.manage'
  | 'subjects.view' | 'subjects.manage'
  | 'ira.view' | 'ira.recalculate' | 'ira.configure' | 'ira.export'
  | 'projects.view' | 'projects.create' | 'projects.edit' | 'projects.delete'
  | 'events.view' | 'events.create' | 'events.edit' | 'events.delete'
  | 'declarations.access'
  | 'teacher_notifications.access' | 'teacher_notifications.manage'
  | 'notifications.access';

export type ConfigurableRole = 'direction' | 'teacher';

export interface PermissionDefinition {
  key: PermissionKey;
  module: string;
  label: string;
  /** Padrões de fábrica (idênticos ao seed do banco). */
  defaults: Record<ConfigurableRole, boolean>;
}

const d = (direction: boolean, teacher: boolean) => ({ direction, teacher });

/** Ordem dos módulos na aba Permissões. */
export const PERMISSION_MODULES = [
  'Alunos', 'Turmas', 'Frequência', 'AEE', 'Professores', 'Disciplinas',
  'IRA', 'Projetos', 'Eventos', 'Documentos', 'Sistema',
] as const;

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: 'students.view', module: 'Alunos', label: 'Acessar alunos', defaults: d(true, true) },
  { key: 'students.create', module: 'Alunos', label: 'Cadastrar aluno', defaults: d(true, true) },
  { key: 'students.edit', module: 'Alunos', label: 'Editar cadastro do aluno', defaults: d(true, true) },
  { key: 'students.delete', module: 'Alunos', label: 'Excluir alunos', defaults: d(true, false) },
  { key: 'occurrences.view', module: 'Alunos', label: 'Visualizar ocorrências e conselho', defaults: d(true, true) },
  { key: 'occurrences.create', module: 'Alunos', label: 'Registrar ocorrência', defaults: d(true, true) },
  { key: 'occurrences.edit', module: 'Alunos', label: 'Editar ocorrência', defaults: d(true, true) },
  { key: 'occurrences.delete', module: 'Alunos', label: 'Excluir ocorrência', defaults: d(true, true) },
  { key: 'grades.view', module: 'Alunos', label: 'Visualizar notas e boletim', defaults: d(true, true) },
  { key: 'grades.manage', module: 'Alunos', label: 'Alterar, importar e consolidar notas', defaults: d(true, false) },
  { key: 'medical_certificates.manage', module: 'Alunos', label: 'Gerenciar atestados médicos', defaults: d(true, true) },

  { key: 'classes.view', module: 'Turmas', label: 'Acessar turmas', defaults: d(true, true) },
  { key: 'classes.create', module: 'Turmas', label: 'Criar turma', defaults: d(true, true) },
  { key: 'classes.edit', module: 'Turmas', label: 'Editar turma', defaults: d(true, true) },
  { key: 'classes.delete', module: 'Turmas', label: 'Excluir turma', defaults: d(true, false) },
  { key: 'classes.import_report_card', module: 'Turmas', label: 'Importar boletim da turma', defaults: d(true, false) },

  { key: 'attendance.view', module: 'Frequência', label: 'Acessar frequência', defaults: d(true, true) },
  { key: 'attendance.record', module: 'Frequência', label: 'Fazer frequência', defaults: d(true, true) },
  { key: 'attendance.edit', module: 'Frequência', label: 'Revisar e atualizar frequência', defaults: d(true, true) },
  { key: 'attendance.delete', module: 'Frequência', label: 'Excluir registro de frequência', defaults: d(true, true) },

  { key: 'aee.view', module: 'AEE', label: 'Acessar Sistema AEE', defaults: d(true, true) },
  { key: 'aee.manage', module: 'AEE', label: 'Gerenciar PEI/PAEE', defaults: d(true, true) },

  { key: 'teachers.view', module: 'Professores', label: 'Acessar professores', defaults: d(true, false) },
  { key: 'teachers.manage', module: 'Professores', label: 'Gerenciar professores', defaults: d(true, false) },

  { key: 'subjects.view', module: 'Disciplinas', label: 'Acessar disciplinas', defaults: d(true, false) },
  { key: 'subjects.manage', module: 'Disciplinas', label: 'Gerenciar matriz curricular', defaults: d(true, false) },

  { key: 'ira.view', module: 'IRA', label: 'Acessar IRA', defaults: d(true, false) },
  { key: 'ira.recalculate', module: 'IRA', label: 'Recalcular IRA', defaults: d(true, false) },
  { key: 'ira.configure', module: 'IRA', label: 'Configurar pesos e períodos do IRA', defaults: d(true, false) },
  { key: 'ira.export', module: 'IRA', label: 'Exportar classificação do IRA', defaults: d(true, false) },

  { key: 'projects.view', module: 'Projetos', label: 'Acessar projetos', defaults: d(true, true) },
  { key: 'projects.create', module: 'Projetos', label: 'Criar projeto', defaults: d(true, true) },
  { key: 'projects.edit', module: 'Projetos', label: 'Editar projeto', defaults: d(true, true) },
  { key: 'projects.delete', module: 'Projetos', label: 'Excluir projeto', defaults: d(true, true) },

  { key: 'events.view', module: 'Eventos', label: 'Acessar eventos', defaults: d(true, true) },
  { key: 'events.create', module: 'Eventos', label: 'Criar evento', defaults: d(true, true) },
  { key: 'events.edit', module: 'Eventos', label: 'Editar evento', defaults: d(true, true) },
  { key: 'events.delete', module: 'Eventos', label: 'Excluir evento', defaults: d(true, true) },

  { key: 'declarations.access', module: 'Documentos', label: 'Acessar e emitir declarações', defaults: d(true, false) },
  { key: 'teacher_notifications.access', module: 'Documentos', label: 'Acessar Notificação Docente', defaults: d(true, false) },
  { key: 'teacher_notifications.manage', module: 'Documentos', label: 'Criar, editar e excluir notificações', defaults: d(true, false) },

  { key: 'notifications.access', module: 'Sistema', label: 'Central de notificações', defaults: d(true, true) },
];

export const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

/** Mapa de permissões padrão de um perfil configurável. */
export function defaultPermissionsFor(role: ConfigurableRole): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.key, p.defaults[role]]));
}

/** Permissões efetivas: admin (global ou da escola) tem tudo liberado. */
export function resolvePermissions(
  role: string | null,
  stored: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  if (role === 'admin') {
    return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
  }
  if (role === 'direction' || role === 'teacher') {
    return { ...defaultPermissionsFor(role), ...(stored ?? {}) };
  }
  // staff e usuários sem vínculo não usam este catálogo.
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
}

export function groupByModule(defs: PermissionDefinition[]): [string, PermissionDefinition[]][] {
  return PERMISSION_MODULES
    .map((m) => [m, defs.filter((p) => p.module === m)] as [string, PermissionDefinition[]])
    .filter(([, items]) => items.length > 0);
}
