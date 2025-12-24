import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  full_name: string;
  class: string;
}

interface ManualAttendanceModalProps {
  onSuccess?: () => void;
}

const ManualAttendanceModal = ({ onSuccess }: ManualAttendanceModalProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'absent' | 'justified'>('present');
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchStudents();
    }
  }, [open]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, class')
      .eq('status', 'active')
      .order('full_name');
    
    setStudents(data || []);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.error('Selecione um aluno');
      return;
    }

    if (isWeekend(selectedDate)) {
      toast.error('Não é permitido registrar presença nos finais de semana');
      return;
    }

    setLoading(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm:ss');

      // Check if already exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', selectedStudent)
        .eq('date', dateStr)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('attendance')
          .update({ 
            status: selectedStatus,
            time: currentTime,
            recorded_by: user?.id 
          })
          .eq('id', existing.id);

        if (error) throw error;
        toast.success('Presença atualizada com sucesso!');
      } else {
        // Insert new
        const { error } = await supabase
          .from('attendance')
          .insert({
            student_id: selectedStudent,
            date: dateStr,
            time: currentTime,
            status: selectedStatus,
            recorded_by: user?.id
          });

        if (error) throw error;
        toast.success('Presença registrada com sucesso!');
      }

      setOpen(false);
      setSelectedStudent('');
      setSelectedDate(new Date());
      setSelectedStatus('present');
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      if (error.message?.includes('finais de semana')) {
        toast.error('Não é permitido registrar presença nos finais de semana');
      } else {
        toast.error('Erro ao salvar presença');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Presença Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Presença Manual</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Student Selection */}
          <div className="space-y-2">
            <Label>Aluno</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.full_name} - {student.class}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => isWeekend(date) || date > new Date()}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {isWeekend(selectedDate) && (
              <p className="text-xs text-destructive">
                Não é permitido registrar presença em finais de semana
              </p>
            )}
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Presente</SelectItem>
                <SelectItem value="absent">Ausente</SelectItem>
                <SelectItem value="justified">Justificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedStudent}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualAttendanceModal;
