import DashboardLayout from '@/components/DashboardLayout';
import IRASettings from '@/components/settings/IRASettings';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, Shield } from 'lucide-react';

const IRA = () => {
  const { userRole } = useAuth();
  // Mesma permissão que existia na aba IRA das Configurações
  const canManageIra = userRole === 'admin' || userRole === 'direction';

  if (!canManageIra) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Acesso Restrito</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
                Você não tem permissão para acessar a configuração do IRA.
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
            <Calculator className="h-6 w-6 text-primary" />
            IRA
          </h1>
          <p className="text-muted-foreground">
            Configure disciplinas, pesos e períodos e exporte a classificação do IRA
          </p>
        </div>

        <IRASettings />
      </div>
    </DashboardLayout>
  );
};

export default IRA;
