import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

const Notifications = () => (
  <DashboardLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground">WhatsApp alerts for absences</p>
      </div>
      <Card>
        <CardContent className="p-12 text-center">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-1">Notification system</h3>
          <p className="text-sm text-muted-foreground">Configure WhatsApp integration in Settings to enable automatic absence alerts</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default Notifications;
