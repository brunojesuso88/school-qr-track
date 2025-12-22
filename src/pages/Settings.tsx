import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Clock, MessageSquare } from 'lucide-react';

const Settings = () => (
  <DashboardLayout>
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Configure attendance system</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Attendance Cutoff Time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Daily Cutoff Time</Label>
            <Input type="time" defaultValue="09:00" className="max-w-xs" />
            <p className="text-xs text-muted-foreground">Students not checked in by this time will be marked absent</p>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            WhatsApp Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Connect to WhatsApp Business API to send automatic absence notifications to guardians.</p>
          <Button variant="outline">Configure WhatsApp</Button>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default Settings;
