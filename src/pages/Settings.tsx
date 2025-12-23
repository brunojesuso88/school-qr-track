import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Clock, MessageSquare, Users, Building2, Download } from 'lucide-react';
import GeneralSettings from '@/components/settings/GeneralSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import UserManagement from '@/components/settings/UserManagement';
import SchoolSettings from '@/components/settings/SchoolSettings';
import DataExport from '@/components/settings/DataExport';
import { useAuth } from '@/contexts/AuthContext';

const Settings = () => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-2">
            <TabsTrigger value="general" className="flex items-center gap-2 py-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 py-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
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

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

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
