import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, ShieldCheck, School } from 'lucide-react';
import { PERMISSION_MODULES, type ConfigurableRole } from '@/lib/permissions/catalog';

interface PermissionRow {
  role: ConfigurableRole;
  permission_key: string;
  module: string;
  label: string;
  sort_order: number;
  allowed: boolean;
  is_default: boolean;
}

interface ManageableSchool {
  school_id: string;
  name: string;
  auto_approve_registration: boolean;
}

const roleLabels: Record<ConfigurableRole, string> = {
  direction: 'Direção',
  teacher: 'Professor',
};

/** Aba Configurações → Permissões: camada única de permissões por escola. */
const SchoolPermissionsPanel = () => {
  const { isGlobalAdmin } = useAuth();
  const { activeSchoolId, activeSchool } = useSchool();
  const { refresh: refreshMyPermissions } = usePermissions();

  const [schools, setSchools] = useState<ManageableSchool[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(activeSchoolId);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState<ConfigurableRole | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('my_manageable_schools');
      if (error) {
        toast.error('Não foi possível carregar as escolas');
        return;
      }
      const list = (data ?? []) as unknown as ManageableSchool[];
      setSchools(list);
      setSchoolId((current) => current ?? activeSchoolId ?? list[0]?.school_id ?? null);
    })();
  }, [activeSchoolId]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_school_permissions', { _school_id: id });
    if (error) toast.error('Não foi possível carregar as permissões');
    setRows((data ?? []) as unknown as PermissionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (schoolId) void load(schoolId);
    else setLoading(false);
  }, [schoolId, load]);

  const schoolName = useMemo(
    () => schools.find((s) => s.school_id === schoolId)?.name
      ?? activeSchool?.school_name ?? 'Escola',
    [schools, schoolId, activeSchool],
  );

  const toggle = async (row: PermissionRow, allowed: boolean) => {
    if (!schoolId) return;
    const token = `${row.role}:${row.permission_key}`;
    setSavingKey(token);
    setRows((prev) => prev.map((r) =>
      r.role === row.role && r.permission_key === row.permission_key
        ? { ...r, allowed, is_default: false } : r));
    const { error } = await supabase.rpc('admin_set_school_permission', {
      _school_id: schoolId,
      _role: row.role,
      _permission_key: row.permission_key,
      _allowed: allowed,
    });
    setSavingKey(null);
    if (error) {
      toast.error(error.message);
      await load(schoolId);
      return;
    }
    toast.success(`${row.label}: ${allowed ? 'liberado' : 'bloqueado'} para ${roleLabels[row.role]}`);
    await refreshMyPermissions();
  };

  const resetRole = async (role: ConfigurableRole) => {
    if (!schoolId) return;
    setResetting(role);
    const { error } = await supabase.rpc('admin_reset_school_permissions', {
      _school_id: schoolId, _role: role,
    });
    setResetting(null);
    if (error) return toast.error(error.message);
    toast.success(`Permissões padrão restauradas para ${roleLabels[role]}`);
    await load(schoolId);
    await refreshMyPermissions();
  };

  const renderRole = (role: ConfigurableRole) => {
    const roleRows = rows.filter((r) => r.role === role);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Ajuste o que o perfil {roleLabels[role]} pode fazer nesta escola. As mudanças valem
            imediatamente para telas, ações e banco de dados.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={resetting === role}>
                {resetting === role
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <RotateCcw className="mr-2 h-4 w-4" />}
                Restaurar permissões padrão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restaurar padrões de {roleLabels[role]}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as personalizações do perfil {roleLabels[role]} em {schoolName} serão
                  substituídas pelos valores padrão do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { void resetRole(role); }}>
                  Restaurar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {PERMISSION_MODULES.map((module) => {
            const items = roleRows.filter((r) => r.module === module);
            if (items.length === 0) return null;
            return (
              <Card key={module}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{module}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((row) => {
                    const id = `${role}-${row.permission_key}`;
                    return (
                      <div key={id} className="flex items-center justify-between gap-3">
                        <Label htmlFor={id} className="text-sm font-normal leading-tight">
                          {row.label}
                          {!row.is_default && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              personalizado
                            </Badge>
                          )}
                        </Label>
                        <Switch
                          id={id}
                          checked={row.allowed}
                          disabled={savingKey === `${role}:${row.permission_key}`}
                          onCheckedChange={(checked) => { void toggle(row, checked); }}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões da escola
          </CardTitle>
          <CardDescription>
            Camada central de permissões por escola. O perfil Administrador nunca é limitado por
            esta tela e mantém todas as permissões administrativas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <School className="h-4 w-4 text-muted-foreground" />
          {isGlobalAdmin && schools.length > 0 ? (
            <Select value={schoolId ?? undefined} onValueChange={setSchoolId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecionar escola" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.school_id} value={s.school_id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">{schoolName}</span>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando permissões...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma permissão disponível para esta escola.
        </p>
      ) : (
        <Tabs defaultValue="teacher">
          <TabsList>
            <TabsTrigger value="direction">Direção</TabsTrigger>
            <TabsTrigger value="teacher">Professor</TabsTrigger>
          </TabsList>
          <TabsContent value="direction" className="mt-4">{renderRole('direction')}</TabsContent>
          <TabsContent value="teacher" className="mt-4">{renderRole('teacher')}</TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SchoolPermissionsPanel;
