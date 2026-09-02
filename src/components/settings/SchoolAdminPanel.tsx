import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2, Check, Copy, Loader2, Plus, RefreshCw, School, Search, ShieldAlert, Trash2,
  UserPlus, Users, X,
} from 'lucide-react';
import { buildJoinUrl, type AppRole } from '@/lib/schools/registration';

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
  const { isGlobalAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: '', city: '', state: '', code: '' });
  const [saving, setSaving] = useState(false);

  const [manageSchool, setManageSchool] = useState<SchoolRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addUserId, setAddUserId] = useState<string>('');
  const [addRole, setAddRole] = useState<AppRole>('teacher');

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

  useEffect(() => {
    if (isGlobalAdmin) void load();
    else setLoading(false);
  }, [isGlobalAdmin, load]);

  const loadMembers = useCallback(async (schoolId: string) => {
    setMembersLoading(true);
    const { data, error } = await supabase.rpc('admin_school_members', { _school_id: schoolId });
    if (error) toast.error('Não foi possível carregar os membros');
    setMembers((data ?? []) as unknown as MemberRow[]);
    setMembersLoading(false);
  }, []);

  const openManage = async (school: SchoolRow) => {
    setManageSchool(school);
    setAddUserId('');
    await loadMembers(school.school_id);
  };

  const copyLink = async (token: string | null) => {
    if (!token) {
      toast.error('Esta escola não possui link ativo. Gere um novo link.');
      return;
    }
    await navigator.clipboard.writeText(buildJoinUrl(token, window.location.origin));
    toast.success('Link de cadastro copiado');
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
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Escola criada com link de cadastro ativo');
    setCreateOpen(false);
    setNewSchool({ name: '', city: '', state: '', code: '' });
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
    await load();
  };

  const removeMembership = async (schoolId: string, userId: string) => {
    const { error } = await supabase.rpc('admin_remove_membership', {
      _school_id: schoolId, _user_id: userId,
    });
    if (error) return toast.error(error.message);
    toast.success('Vínculo removido (a conta do usuário foi preservada)');
    await loadMembers(schoolId);
    await load();
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

  if (!isGlobalAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 gap-3 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Área exclusiva do administrador global.
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

  return (
    <div className="space-y-6">
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
                <Badge variant={s.status === 'active' ? 'default' : 'outline'}>
                  {s.status === 'active' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <div className="rounded-md bg-muted/50 p-2 text-xs break-all font-mono">
                {s.token ? buildJoinUrl(s.token, window.location.origin) : 'Nenhum link ativo'}
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
                  ? buildJoinUrl(manageSchool.token, window.location.origin)
                  : 'Nenhum link ativo'}
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
                  members.map((m) => (
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
                          onValueChange={(v) =>
                            upsertMembership(manageSchool.school_id, m.user_id, v as AppRole, m.status)}
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
                            onClick={() => upsertMembership(manageSchool.school_id, m.user_id, m.role, 'active')}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                        )}
                        {m.status === 'pending' && (
                          <Button size="sm" variant="ghost"
                            onClick={() => upsertMembership(manageSchool.school_id, m.user_id, m.role, 'rejected')}>
                            <X className="h-3.5 w-3.5 mr-1" /> Recusar
                          </Button>
                        )}
                        {m.status === 'active' && (
                          <Button size="sm" variant="outline"
                            onClick={() => upsertMembership(manageSchool.school_id, m.user_id, m.role, 'inactive')}>
                            Desativar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={m.user_id === user?.id}
                          onClick={() => removeMembership(manageSchool.school_id, m.user_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover vínculo
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolAdminPanel;
