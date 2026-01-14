import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Loader2, Shield, UserCog, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
// Tipo local para roles usadas no sistema (exclui 'user' que foi removido)
type AppRole = 'admin' | 'direction' | 'teacher' | 'staff';

interface UserWithRole {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  createdAt: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  direction: 'Direção',
  teacher: 'Professor',
  staff: 'Funcionário'
};

const roleBadgeVariants: Record<AppRole, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  admin: 'destructive',
  direction: 'default',
  teacher: 'secondary',
  staff: 'outline'
};

const UserManagement = () => {
  const { userRole, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || '',
          fullName: profile.full_name || 'Sem nome',
          role: (userRole?.role as AppRole) || 'teacher',
          createdAt: profile.created_at || ''
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      toast.success('Função atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar função');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao excluir usuário');
      }

      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('Usuário excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (userRole !== 'admin') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
            Apenas administradores podem gerenciar usuários e suas funções.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Usuários do Sistema
            <Badge variant="secondary">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função Atual</TableHead>
                  <TableHead>Alterar Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">{userItem.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{userItem.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariants[userItem.role]}>
                        {roleLabels[userItem.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={userItem.role}
                        onValueChange={(value) => handleRoleChange(userItem.id, value as AppRole)}
                        disabled={updatingUserId === userItem.id || userItem.id === user?.id}
                      >
                        <SelectTrigger className="w-[160px]">
                          {updatingUserId === userItem.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="direction">Direção</SelectItem>
                          <SelectItem value="teacher">Professor</SelectItem>
                          <SelectItem value="staff">Funcionário</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {userItem.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === userItem.id}
                            >
                              {deletingUserId === userItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o usuário <strong>{userItem.fullName}</strong>?
                                Esta ação não pode ser desfeita e todos os dados associados serão perdidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteUser(userItem.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Sobre as Funções
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <Badge variant="destructive" className="mb-2">Administrador</Badge>
              <p className="text-sm text-muted-foreground">
                Acesso total ao sistema, incluindo configurações e gestão de usuários.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Badge variant="default" className="mb-2">Direção</Badge>
              <p className="text-sm text-muted-foreground">
                Acesso total ao sistema, exceto gestão de usuários.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Badge variant="secondary" className="mb-2">Professor</Badge>
              <p className="text-sm text-muted-foreground">
                Acesso a todas as funções, exceto configurações do sistema.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Badge variant="outline" className="mb-2">Funcionário</Badge>
              <p className="text-sm text-muted-foreground">
                Acesso apenas à função de leitura de QR Code na tela inicial.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
