import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, Clock, Users, AlertCircle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DailyClassAttendanceDialog from './DailyClassAttendanceDialog';
import { buildDailyClassRows, summarizeDaily, localDateKey, type DailyClassRow } from '@/lib/attendance/dailyStatus';

const shiftLabel = (shift?: string | null) => {
  switch (shift) {
    case 'morning':
      return 'Manhã';
    case 'afternoon':
      return 'Tarde';
    case 'evening':
      return 'Noite';
    default:
      return null;
  }
};

const DailyAttendancePanel = () => {
  const [rows, setRows] = useState<DailyClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DailyClassRow | null>(null);

  const today = new Date();
  const todayKey = localDateKey(today);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, studentsRes, closuresRes] = await Promise.all([
        supabase.from('classes').select('id, name, shift, status').order('name'),
        supabase.from('students').select('id, class, status'),
        supabase.from('daily_attendance_closures').select('class_name, date, present_count, absent_count, updated_at').eq('date', todayKey),
      ]);
      if (classesRes.error) throw classesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (closuresRes.error) throw closuresRes.error;

      const activeClasses = (classesRes.data || []).filter((c) => (c.status ?? 'active') === 'active');
      setRows(buildDailyClassRows(activeClasses, studentsRes.data || [], closuresRes.data || [], todayKey));
    } catch (e) {
      setError('Não foi possível carregar as turmas do dia. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const summary = summarizeDaily(rows);

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarCheck className="w-4 h-4 text-primary" />
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{summary.done}</span> de{' '}
              <span className="font-semibold text-foreground">{summary.total}</span> turmas com frequência realizada
              {' · '}
              <span className="font-semibold text-foreground">{summary.pending}</span> pendentes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar turma..."
              className="h-9 w-full sm:w-48 bg-background"
              aria-label="Buscar turma"
            />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} aria-label="Atualizar lista">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'Nenhuma turma ativa cadastrada.' : 'Nenhuma turma encontrada para esta busca.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const done = row.status === 'done';
            return (
              <Card
                key={row.id}
                className={
                  done
                    ? 'border-emerald-500/40 transition-shadow hover:shadow-md'
                    : 'border-amber-500/50 transition-shadow hover:shadow-md'
                }
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shiftLabel(row.shift) ? `${shiftLabel(row.shift)} · ` : ''}
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {row.activeStudents} aluno(s) ativo(s)
                        </span>
                      </p>
                    </div>
                    <Badge variant={done ? 'default' : 'outline'} className="shrink-0 gap-1">
                      {done ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {done ? 'Realizada' : 'Pendente'}
                    </Badge>
                  </div>

                  {done && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {row.updatedAt ? `Atualizada às ${format(new Date(row.updatedAt), 'HH:mm')}` : 'Registrada hoje'}
                      {row.presentCount !== null && ` · ${row.presentCount}P / ${row.absentCount ?? 0}A`}
                    </p>
                  )}

                  <Button
                    className="w-full"
                    variant={done ? 'outline' : 'default'}
                    disabled={row.activeStudents === 0}
                    onClick={() => setSelected(row)}
                  >
                    {done ? 'Revisar/Atualizar frequência' : 'Fazer frequência'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <DailyClassAttendanceDialog
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          className={selected.name}
          shift={selected.shift}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default DailyAttendancePanel;
