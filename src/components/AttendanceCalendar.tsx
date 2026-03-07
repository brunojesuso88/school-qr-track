import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileDown, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarAttendance {
  date: string;
  student_id: string;
  status: string;
  student_name: string;
  student_class: string;
}

const AttendanceCalendar = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [datesWithAttendance, setDatesWithAttendance] = useState<Set<string>>(new Set());
  const [dayRecords, setDayRecords] = useState<CalendarAttendance[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    fetchMonthDates();
  }, [calendarMonth]);

  useEffect(() => {
    if (selectedDate) {
      fetchDayAttendance(selectedDate);
    }
  }, [selectedDate]);

  const fetchMonthDates = async () => {
    const start = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('attendance')
      .select('date')
      .gte('date', start)
      .lte('date', end);

    const dates = new Set((data || []).map(d => d.date));
    setDatesWithAttendance(dates);
  };

  const fetchDayAttendance = async (date: Date) => {
    setLoadingDay(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('attendance')
      .select('date, student_id, status, students!inner(full_name, class)')
      .eq('date', dateStr)
      .order('status');

    const records: CalendarAttendance[] = (data || []).map((r: any) => ({
      date: r.date,
      student_id: r.student_id,
      status: r.status,
      student_name: r.students.full_name,
      student_class: r.students.class,
    }));

    setDayRecords(records);
    setLoadingDay(false);
  };

  const groupedByClass = dayRecords.reduce<Record<string, CalendarAttendance[]>>((acc, r) => {
    if (!acc[r.student_class]) acc[r.student_class] = [];
    acc[r.student_class].push(r);
    return acc;
  }, {});

  const generateDayReport = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, 'dd/MM/yyyy');
    const classes = Object.keys(groupedByClass).sort();

    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Frequência - ${dateStr}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 25px; }
    .info { margin: 10px 0; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .present { color: #16a34a; font-weight: bold; }
    .absent { color: #dc2626; font-weight: bold; }
    .justified { color: #6b7280; font-weight: bold; }
    .summary { background: #f0fdf4; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Relatório de Frequência Diária</h1>
  <p class="info">Data: ${dateStr}</p>
  <p class="info">Total de registros: ${dayRecords.length}</p>

  ${classes.map(cls => {
    const records = groupedByClass[cls];
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    return `
      <h2>Turma: ${cls}</h2>
      <div class="summary">
        Presentes: <span class="present">${present}</span> | 
        Ausentes: <span class="absent">${absent}</span> | 
        Total: ${records.length}
      </div>
      <table>
        <thead><tr><th>Aluno</th><th>Status</th></tr></thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${r.student_name}</td>
              <td class="${r.status}">${r.status === 'present' ? 'Presente' : r.status === 'absent' ? 'Ausente' : 'Justificado'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }).join('')}

  <p class="info" style="margin-top: 30px;">Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onload = () => win.print();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          Calendário de Frequência Diária
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="flex-shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto rounded-md border")}
              modifiers={{
                hasAttendance: (date) => datesWithAttendance.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersStyles={{
                hasAttendance: {
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  borderRadius: '50%',
                  fontWeight: 'bold',
                },
              }}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Dias com fundo colorido possuem registros de frequência
            </p>
          </div>

          {/* Day details */}
          <div className="flex-1 min-w-0">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-semibold text-base">
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </h3>
                  {dayRecords.length > 0 && (
                    <Button variant="outline" size="sm" onClick={generateDayReport}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Gerar Relatório do Dia
                    </Button>
                  )}
                </div>

                {loadingDay ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : dayRecords.length > 0 ? (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {Object.keys(groupedByClass).sort().map(cls => {
                      const records = groupedByClass[cls];
                      const present = records.filter(r => r.status === 'present').length;
                      const absent = records.filter(r => r.status === 'absent').length;
                      return (
                        <div key={cls}>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-sm">Turma {cls}</h4>
                            <Badge variant="outline" className="text-xs gap-1">
                              <UserCheck className="w-3 h-3 text-green-600" /> {present}
                            </Badge>
                            <Badge variant="outline" className="text-xs gap-1">
                              <UserX className="w-3 h-3 text-red-600" /> {absent}
                            </Badge>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Aluno</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {records.map((r, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-sm">{r.student_name}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge
                                        variant={r.status === 'present' ? 'default' : r.status === 'absent' ? 'destructive' : 'secondary'}
                                        className={r.status === 'present' ? 'bg-green-500' : ''}
                                      >
                                        {r.status === 'present' ? 'Presente' : r.status === 'absent' ? 'Ausente' : 'Justificado'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum registro de frequência neste dia</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecione um dia no calendário para ver a frequência</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendar;
