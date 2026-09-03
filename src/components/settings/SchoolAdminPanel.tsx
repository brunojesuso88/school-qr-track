import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePublicAppUrl } from '@/hooks/usePublicAppUrl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2, Check, Copy, Globe, Loader2, Plus, RefreshCw, School, Search, ShieldAlert, Trash2,
  UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { buildJoinUrl, type AppRole } from '@/lib/schools/registration';
import { PREVIEW_LINK_WARNING, PUBLIC_URL_CHANGE_WARNING } from '@/lib/schools/publicUrl';

interface SchoolRow {
  school_id: string;
  name: string;
  slug: string;
  code: string;
  status: string;
  city: string | null;
  state: string | null;
  member_count: number;
  pending_count: number;
  token: string | null;
  auto_approve_registration: boolean;
}

interface MemberRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  status: string;
  created_at: string;
}

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_global_admin: boolean;
  memberships: { school_id: string; school_name: string; role: AppRole; status: string }[];
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador da escola',
  direction: 'Direção',
  teacher: 'Professor',
  staff: 'Funcionário',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  inactive: 'Inativo',
  rejected: 'Recusado',
};

const statusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  status === 'active' ? 'default' : status === 'pending' ? 'secondary' : 'outline';

const SchoolAdminPanel = () => {
  const { isGlobalAdmin, user, userRole } = useAuth();
  const { activeSchoolId, activeSchool, setActiveSchoolId, refresh: refreshSchools } = useSchool();
  // Direção mantém as permissões atuais: gestão de usuários é do administrador.
  const isSchoolAdmin = !isGlobalAdmin && userRole === 'admin';

  const { configuredUrl, publicOrigin, save: savePublicUrl } = usePublicAppUrl();
  const [urlDraft, setUrlDraft] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  useEffect(() => setUrlDraft(configuredUrl ?? ''), [configuredUrl]);

  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [newSchool, setNewSchool] = useState({
    name: '', city: '', state: '', code: '', autoApprove: false,
  });
  const [autoApproveBusy, setAutoApproveBusy] = useState<string | null>(null);
  const [deleteSchool, setDeleteSchool] = useState<SchoolRow | null>(null);
  const [deleteSchoolConfirm, setDeleteSchoolConfirm] = useState('');
  const [deletingSchool, setDeletingSchool] = useState(false);
  const [deleteAccountUser, setDeleteAccountUser] = useState<UserRow | null>(null);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const [manageSchool, setManageSchool] = useState<SchoolRow | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [activeNameDraft, setActiveNameDraft] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addUserId, setAddUserId] = useState<string>('');
  const [addRole, setAddRole] = useState<AppRole>('teacher');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');

  const joinUrl = useCallback(
    (token: string | null) => (token ? buildJoinUrl(token, publicOrigin) : null),
    [publicOrigin],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [schoolsRes, usersRes] = await Promise.all([
      supabase.rpc('admin_school_overview'),
      supabase.rpc('admin_list_users'),
    ]);
    if (schoolsRes.error) toast.error('Não foi possível carregar as escolas');
    if (usersRes.error) toast.error('Não foi possível carregar os usuários');
    setSchools((schoolsRes.data ?? []) as unknown as SchoolRow[]);
    setUsers((usersRes.data ?? []) as unknown as UserRow[]);
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async (schoolId: string) => {
    setMembersLoading(true);
    const { data, error } = await supabase.rpc('admin_school_members', { _school_id: schoolId });
    if (error) toast.error('Não foi possível carregar os membros');
    setMembers((data ?? []) as unknown as MemberRow[]);
    setMembersLoading(false);
  }, []);

  useEffect(() => {
    if (isGlobalAdmin) {
      void load();
    } else if (isSchoolAdmin && activeSchoolId) {
      setLoading(false);
      void loadMembers(activeSchoolId);
    } else {
      setLoading(false);
    }
  }, [isGlobalAdmin, isSchoolAdmin, activeSchoolId, load, loadMembers]);

  useEffect(() => setActiveNameDraft(activeSchool?.school_name ?? ''), [activeSchool?.school_name]);

  const openManage = async (school: SchoolRow) => {
    setManageSchool(school);
    setRenameDraft(school.name);
    setAddUserId('');
    await loadMembers(school.school_id);
  };

  /**
   * Renomeia a escola: `schools.name` é a fonte canônica e a RPC sincroniza
   * `settings.school_name` da MESMA escola (documentos/PDFs). Slug, código e
   * link `/join/:token` permanecem inalterados.
   */
  const renameSchool = async (schoolId: string, name: string) => {
    const value = name.trim();
    if (value.length < 3 || value.length > 150) {
      return toast.error('O nome da escola deve ter entre 3 e 150 caracteres');
    }
    setRenaming(true);
    const { error } = await supabase.rpc('admin_rename_school', {
      _school_id: schoolId, _name: value,
    });
    setRenaming(false);
    if (error) return toast.error(error.message);
    setSchools((prev) => prev.map((s) => (s.school_id === schoolId ? { ...s, name: value } : s)));
    setManageSchool((prev) => (prev && prev.school_id === schoolId ? { ...prev, name: value } : prev));
    await refreshSchools();
    if (isGlobalAdmin) await load();
    toast.success('Nome da escola atualizado');
  };

  const copyLink = async (token: string | null) => {
    const url = joinUrl(token);
    if (!token) {
      toast.error('Esta escola não possui link ativo. Gere um novo link.');
      return;
    }
    if (!url) {
      toast.error(PREVIEW_LINK_WARNING);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link público de cadastro copiado');
  };

  const persistPublicUrl = async () => {
    setSavingUrl(true);
    const { error } = await savePublicUrl(urlDraft);
    setSavingUrl(false);
    if (error) return toast.error(error);
    toast.success('URL pública atualizada');
  };

  const regenerate = async (schoolId: string) => {
    const { error } = await supabase.rpc('admin_regenerate_registration_link', { _school_id: schoolId });
    if (error) return toast.error(error.message);
    toast.success('Novo link gerado. O link anterior foi revogado.');
    await load();
  };

  const revoke = async (schoolId: string) => {
    const { error } = await supabase.rpc('admin_revoke_registration_link', { _school_id: schoolId });
    if (error) return toast.error(error.message);
    toast.success('Link revogado');
    await load();
  };

  const createSchool = async () => {
    if (!newSchool.name.trim()) return toast.error('Informe o nome da escola');
    setSaving(true);
    const { error } = await supabase.rpc('admin_create_school', {
      _name: newSchool.name.trim(),
      _city: newSchool.city.trim() || null,
      _state: newSchool.state.trim() || null,
      _code: newSchool.code.trim() || null,
      _auto_approve: newSchool.autoApprove,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Escola criada com link de cadastro ativo');
    setCreateOpen(false);
    setNewSchool({ name: '', city: '', state: '', code: '', autoApprove: false });
    await load();
  };

  const upsertMembership = async (
    schoolId: string, userId: string, role: AppRole, status: string,
  ) => {
    const { error } = await supabase.rpc('admin_upsert_membership', {
      _school_id: schoolId, _user_id: userId, _role: role, _status: status,
    });
    if (error) return toast.error(error.message);
    toast.success('Vínculo atualizado');
    await loadMembers(schoolId);
    if (isGlobalAdmin) await load();
  };

  const removeMembership = async (schoolId: string, userId: string) => {
    const { error } = await supabase.rpc('admin_remove_membership', {
      _school_id: schoolId, _user_id: userId,
    });
    if (error) return toast.error(error.message);
    toast.success('Vínculo removido (a conta do usuário foi preservada)');
    await loadMembers(schoolId);
    if (isGlobalAdmin) await load();
  };

  /** Aceite automático de novos cadastros pelo link exclusivo da escola. */
  const toggleAutoApprove = async (school: SchoolRow, enabled: boolean) => {
    setAutoApproveBusy(school.school_id);
    const { error } = await supabase.rpc('admin_set_school_auto_approve', {
      _school_id: school.school_id, _enabled: enabled,
    });
    setAutoApproveBusy(null);
    if (error) return toast.error(error.message);
    setSchools((prev) => prev.map((s) =>
      s.school_id === school.school_id ? { ...s, auto_approve_registration: enabled } : s));
    setManageSchool((prev) => prev && prev.school_id === school.school_id
      ? { ...prev, auto_approve_registration: enabled } : prev);
    toast.success(enabled
      ? 'Novos cadastros por link serão aceitos automaticamente'
      : 'Novos cadastros por link ficarão pendentes de aprovação');
  };

  /** Exclusão DEFINITIVA da escola: exclusiva do administrador global. */
  const confirmDeleteSchool = async () => {
    if (!deleteSchool) return;
    setDeletingSchool(true);
    try {
      const response = await supabase.functions.invoke('delete-school', {
        body: { schoolId: deleteSchool.school_id },
      });
      const payload = response.data as { error?: string } | null;
      if (response.error || payload?.error) {
        throw new Error(payload?.error ?? response.error?.message ?? 'Falha ao excluir escola');
      }
      toast.success('Escola excluída definitivamente');
      setDeleteSchool(null);
      setDeleteSchoolConfirm('');
      if (activeSchoolId === deleteSchool.school_id) setActiveSchoolId(null);
      await refreshSchools();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a escola');
    } finally {
      setDeletingSchool(false);
    }
  };

  /** Exclusão da CONTA inteira: exclusiva do administrador global. */
  const deleteAccount = async (schoolId: string | null, userId: string) => {
    setDeletingUserId(userId);
    try {
      const response = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (response.error) throw new Error(response.error.message);
      toast.success('Conta excluída em todas as escolas');
      if (schoolId) await loadMembers(schoolId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a conta');
    } finally {
      setDeletingUserId(null);
    }
  };

  const [migrating, setMigrating] = useState(false);

  /** Executa a migração em lotes, reinvocando até concluir (idempotente). */
  const migrateStorage = async () => {
    setMigrating(true);
    try {
      let moved = 0;
      let failed = 0;
      for (let round = 0; round < 40; round++) {
        const { data, error } = await supabase.functions.invoke('migrate-storage-school-scope');
        if (error) throw error;
        if (data?.success === false) throw new Error(data.error ?? 'Falha na migração');
        const report = (data?.report ?? {}) as Record<string, { migrated: number; failed: string[] }>;
        moved += Object.values(report).reduce((acc, r) => acc + r.migrated, 0);
        failed += Object.values(report).reduce((acc, r) => acc + r.failed.length, 0);
        if (data?.done !== false) break;
        toast.info(`Migrando arquivos... ${moved} concluídos`);
      }
      toast.success(`Arquivos migrados: ${moved}.${failed ? ` ${failed} falha(s).` : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível migrar os arquivos.');
    } finally {
      setMigrating(false);
    }
  };

  const totals = useMemo(() => {
    const pending = users.reduce(
      (acc, u) => acc + u.memberships.filter((m) => m.status === 'pending').length, 0);
    const activeUsers = users.filter((u) =>
      u.is_global_admin || u.memberships.some((m) => m.status === 'active')).length;
    return {
      schools: schools.filter((s) => s.status === 'active').length,
      users: users.length,
      pending,
      activeUsers,
    };
  }, [schools, users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (term && !(u.full_name ?? '').toLowerCase().includes(term)
          && !(u.email ?? '').toLowerCase().includes(term)) return false;
      if (schoolFilter !== 'all' && !u.memberships.some((m) => m.school_id === schoolFilter)) return false;
      if (statusFilter !== 'all' && !u.memberships.some((m) => m.status === statusFilter)) return false;
      return true;
    });
  }, [users, search, schoolFilter, statusFilter]);

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (term && !(m.full_name ?? '').toLowerCase().includes(term)
          && !(m.email ?? '').toLowerCase().includes(term)) return false;
      if (memberStatusFilter !== 'all' && m.status !== memberStatusFilter) return false;
      return true;
    });
  }, [members, memberSearch, memberStatusFilter]);

  /** Card de membro reutilizado nos dois modos (global e escola ativa). */
  const renderMember = (schoolId: string, m: MemberRow, allowAccountDeletion: boolean) => (
    <div key={m.user_id} className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{m.full_name ?? 'Sem nome'}</p>
          <p className="text-xs text-muted-foreground">{m.email}</p>
        </div>
        <Badge variant={statusVariant(m.status)}>{statusLabels[m.status]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={m.role}
          onValueChange={(v) => upsertMembership(schoolId, m.user_id, v as AppRole, m.status)}
        >
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(roleLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {m.status !== 'active' && (
          <Button size="sm" variant="outline"
            onClick={() => upsertMembership(schoolId, m.user_id, m.role, 'active')}>
            <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
          </Button>
        )}
        {m.status === 'pending' && (
          <Button size="sm" variant="ghost"
            onClick={() => upsertMembership(schoolId, m.user_id, m.role, 'rejected')}>
            <X className="h-3.5 w-3.5 mr-1" /> Recusar
          </Button>
        )}
        {m.status === 'active' && (
          <Button size="sm" variant="outline"
            onClick={() => upsertMembership(schoolId, m.user_id, m.role, 'inactive')}>
            Desativar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={m.user_id === user?.id}
          onClick={() => removeMembership(schoolId, m.user_id)}
        >
          <UserMinus className="h-3.5 w-3.5 mr-1" /> Remover vínculo
        </Button>
        {allowAccountDeletion && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={m.user_id === user?.id || deletingUserId === m.user_id}
              >
                {deletingUserId === m.user_id
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Excluir conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir a conta inteira?</AlertDialogTitle>
                <AlertDialogDescription>
                  A conta de <strong>{m.full_name ?? m.email}</strong> será excluída do EDUNEXUS.
                  Isso remove o acesso em <strong>todas as escolas</strong> e não pode ser desfeito.
                  Para apenas retirar o acesso desta escola, use “Remover vínculo”.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteAccount(schoolId, m.user_id)}
                >
                  Excluir conta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );

  if (!isGlobalAdmin && !isSchoolAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Área exclusiva do administrador da escola.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ============ Modo escola ativa (administrador não global) ============
  if (isSchoolAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" /> Usuários de {activeSchool?.school_name ?? 'sua escola'}
          </CardTitle>
          <CardDescription>
            Aprove solicitações, altere funções e remova vínculos desta escola.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou e-mail"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <Select value={memberStatusFilter} onValueChange={setMemberStatusFilter}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {membersLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
          ) : (
            <div className="space-y-3">
              {activeSchoolId && filteredMembers.map((m) => renderMember(activeSchoolId, m, false))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ============ Modo administrador global ============
  return (
    <div className="space-y-6">
      {/* URL pública canônica do cadastro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" /> URL pública do EDUNEXUS
          </CardTitle>
          <CardDescription>
            Base usada nos links exclusivos de cadastro. Nunca use o endereço de preview do editor —
            quem recebe o link não deve precisar de conta Lovable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://suaescola.com.br"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
            />
            <Button onClick={persistPublicUrl} disabled={savingUrl}>
              {savingUrl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {publicOrigin
              ? `Links de cadastro serão gerados em ${publicOrigin}/join/...`
              : PREVIEW_LINK_WARNING}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">{PUBLIC_URL_CHANGE_WARNING}</p>
        </CardContent>
      </Card>

      {/* Migração one-shot dos arquivos legados para pastas por escola */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Arquivos por escola</CardTitle>
            <CardDescription>
              Move os arquivos antigos (fotos, anexos, imagens de eventos) para a pasta
              da escola e atualiza as referências. Pode ser executado mais de uma vez.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={migrating} onClick={migrateStorage}>
            {migrating ? 'Migrando...' : 'Migrar arquivos'}
          </Button>
        </CardHeader>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Escolas ativas', value: totals.schools, icon: School },
          { label: 'Usuários', value: totals.users, icon: Users },
          { label: 'Vínculos pendentes', value: totals.pending, icon: UserPlus },
          { label: 'Usuários com acesso', value: totals.activeUsers, icon: Check },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Escolas */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" /> Escolas
            </CardTitle>
            <CardDescription>Cada escola possui um link exclusivo de cadastro.</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova escola
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {schools.map((s) => (
            <div key={s.school_id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.code} · {[s.city, s.state].filter(Boolean).join('/') || 'sem cidade'} ·{' '}
                    {s.member_count} membros
                    {s.pending_count > 0 && ` · ${s.pending_count} pendentes`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.auto_approve_registration && (
                    <Badge variant="secondary">Aceite automático</Badge>
                  )}
                  <Badge variant={s.status === 'active' ? 'default' : 'outline'}>
                    {s.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-md bg-muted/50 p-2 text-xs break-all font-mono">
                {s.token
                  ? joinUrl(s.token) ?? PREVIEW_LINK_WARNING
                  : 'Nenhum link ativo'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openManage(s)}>Gerenciar</Button>
                <Button size="sm" variant="outline" onClick={() => copyLink(s.token)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                </Button>
                <Button size="sm" variant="outline" onClick={() => regenerate(s.school_id)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => revoke(s.school_id)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Revogar
                </Button>
              </div>
              {/* Aceite automático por escola */}
              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3">
                <div>
                  <p className="text-sm font-medium">Aceitar novos cadastros automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Ligado: quem usa o link entra direto com acesso ativo. Desligado: fica pendente
                    de aprovação da gestão.
                  </p>
                </div>
                <Switch
                  checked={s.auto_approve_registration}
                  disabled={autoApproveBusy === s.school_id}
                  onCheckedChange={(v) => toggleAutoApprove(s, v)}
                />
              </div>
              {/* Zona destrutiva separada */}
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Excluir esta escola remove definitivamente todos os dados e arquivos dela.
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setDeleteSchool(s); setDeleteSchoolConfirm(''); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir escola
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Usuários globais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" /> Usuários do sistema
          </CardTitle>
          <CardDescription>Busque por nome ou e-mail e veja os vínculos por escola.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou e-mail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Escola" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as escolas</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.school_id} value={s.school_id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Escolas e papéis</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <p className="font-medium">{u.full_name ?? 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      {u.is_global_admin && (
                        <Badge variant="destructive" className="mt-1">Admin global</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.memberships.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem vínculo escolar</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.map((m) => (
                            <Badge key={m.school_id} variant={statusVariant(m.status)}>
                              {m.school_name} · {roleLabels[m.role]} · {statusLabels[m.status]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={u.user_id === user?.id || deletingUserId === u.user_id}
                        onClick={() => { setDeleteAccountUser(u); setDeleteAccountConfirm(''); }}
                      >
                        {deletingUserId === u.user_id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                        Excluir definitivamente
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Nova escola */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova escola</DialogTitle>
            <DialogDescription>
              O apelido (slug) e o código são gerados automaticamente, junto com o link de cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={newSchool.name}
                onChange={(e) => setNewSchool((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input
                  value={newSchool.city}
                  onChange={(e) => setNewSchool((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  value={newSchool.state}
                  onChange={(e) => setNewSchool((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Código institucional (opcional)</Label>
              <Input
                value={newSchool.code}
                onChange={(e) => setNewSchool((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <Label>Aceitar novos cadastros automaticamente</Label>
                <p className="text-xs text-muted-foreground">
                  Sem necessidade de aprovação manual do administrador.
                </p>
              </div>
              <Switch
                checked={newSchool.autoApprove}
                onCheckedChange={(v) => setNewSchool((p) => ({ ...p, autoApprove: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createSchool} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar escola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Painel da escola */}
      <Dialog open={!!manageSchool} onOpenChange={(open) => !open && setManageSchool(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageSchool?.name}</DialogTitle>
            <DialogDescription>
              {manageSchool?.code} ·{' '}
              {[manageSchool?.city, manageSchool?.state].filter(Boolean).join('/') || 'sem cidade'}
            </DialogDescription>
          </DialogHeader>

          {manageSchool && (
            <div className="space-y-5">
              <div className="rounded-md bg-muted/50 p-2 text-xs break-all font-mono">
                {manageSchool.token
                  ? joinUrl(manageSchool.token) ?? PREVIEW_LINK_WARNING
                  : 'Nenhum link ativo'}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Aceitar novos cadastros automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Vale apenas para cadastros feitos pelo link exclusivo desta escola.
                  </p>
                </div>
                <Switch
                  checked={manageSchool.auto_approve_registration}
                  disabled={autoApproveBusy === manageSchool.school_id}
                  onCheckedChange={(v) => toggleAutoApprove(manageSchool, v)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Adicionar usuário existente</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={addUserId} onValueChange={setAddUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => !members.some((m) => m.user_id === u.user_id))
                        .map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name ?? u.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                    <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!addUserId}
                    onClick={() =>
                      upsertMembership(manageSchool.school_id, addUserId, addRole, 'active')}
                  >
                    <UserPlus className="h-4 w-4 mr-1" /> Vincular
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Membros</p>
                {membersLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  members.map((m) => renderMember(manageSchool.school_id, m, true))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação forte: excluir escola */}
      <Dialog
        open={!!deleteSchool}
        onOpenChange={(open) => { if (!open) { setDeleteSchool(null); setDeleteSchoolConfirm(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir a escola “{deleteSchool?.name}”?</DialogTitle>
            <DialogDescription>
              Todos os alunos, turmas, frequências, notas, projetos, eventos, documentos e arquivos
              desta escola serão excluídos definitivamente. As contas dos usuários são preservadas e
              continuam válidas nas outras escolas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Para confirmar, digite o nome da escola: <strong>{deleteSchool?.name}</strong>
            </Label>
            <Textarea
              rows={2}
              value={deleteSchoolConfirm}
              onChange={(e) => setDeleteSchoolConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSchool(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={
                deletingSchool
                || deleteSchoolConfirm.trim().toLowerCase() !== (deleteSchool?.name ?? '').toLowerCase()
              }
              onClick={confirmDeleteSchool}
            >
              {deletingSchool && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação forte: excluir conta de usuário */}
      <Dialog
        open={!!deleteAccountUser}
        onOpenChange={(open) => {
          if (!open) { setDeleteAccountUser(null); setDeleteAccountConfirm(''); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir definitivamente esta conta?</DialogTitle>
            <DialogDescription>
              A conta de <strong>{deleteAccountUser?.full_name ?? deleteAccountUser?.email}</strong>{' '}
              será removida do EDUNEXUS, junto com o acesso em todas as escolas. Os dados
              pedagógicos já registrados (alunos, frequência, notas, ocorrências) são preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Para confirmar, digite <strong>EXCLUIR</strong></Label>
            <Input
              value={deleteAccountConfirm}
              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccountUser(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={
                deleteAccountConfirm.trim().toUpperCase() !== 'EXCLUIR'
                || deletingUserId === deleteAccountUser?.user_id
              }
              onClick={async () => {
                if (!deleteAccountUser) return;
                await deleteAccount(null, deleteAccountUser.user_id);
                setDeleteAccountUser(null);
                setDeleteAccountConfirm('');
              }}
            >
              {deletingUserId === deleteAccountUser?.user_id
                && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolAdminPanel;
