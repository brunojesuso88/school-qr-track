import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Clock, MessageSquare, Users, Building2, Download } from 'lucide-react';
import GeneralSettings from '@/components/settings/GeneralSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import UserManagement from '@/components/settings/UserManagement';
import SchoolSettings from '@/components/settings/SchoolSettings';
import DataExport from '@/components/settings/DataExport';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const Settings = () => {
  const { userRole, canAccessSettings, canManageUsers } = useAuth();

  // Block access for teacher and staff
  if (!canAccessSettings) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Acesso Restrito</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
                Você não tem permissão para acessar as configurações do sistema.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie as configurações do sistema de presença
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className={`grid w-full h-auto gap-2 ${canManageUsers ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
            <TabsTrigger value="general" className="flex items-center gap-2 py-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            {/* Only show Users tab for admin */}
            {canManageUsers && (
              <TabsTrigger value="users" className="flex items-center gap-2 py-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="school" className="flex items-center gap-2 py-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Escola</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2 py-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Dados</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            {canManageUsers && (
              <TabsContent value="users">
                <UserManagement />
              </TabsContent>
            )}

            <TabsContent value="school">
              <SchoolSettings />
            </TabsContent>

            <TabsContent value="export">
              <DataExport />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
