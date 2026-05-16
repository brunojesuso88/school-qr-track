import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GraduationCap, Users, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

export default function ClassSummaryDialog({ open, onOpenChange, className }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [days] = useState(30);

  useEffect(() => {
    if (!open || !className) return;
    (async () => {
      setLoading(true);
      try {
        const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
        const { data: students } = await supabase
          .from('students')
          .select('id, full_name')
          .eq('class', className)
          .eq('status', 'active')
          .order('full_name');
        const ids = (students || []).map(s => s.id);
        if (!ids.length) { setRows([]); return; }
        const { data: att } = await supabase
          .from('attendance')
          .select('student_id, status, date')
          .in('student_id', ids)
          .gte('date', since);
        const map = new Map<string, StudentRow>();
        (students || []).forEach(s => map.set(s.id, {
          id: s.id, full_name: s.full_name, present: 0, absent: 0, late: 0, total: 0, rate: 0,
        }));
        (att || []).forEach((a: any) => {
          const r = map.get(a.student_id);
          if (!r) return;
          r.total++;
          if (a.status === 'present') r.present++;
          else if (a.status === 'late') r.late++;
          else if (a.status === 'absent') r.absent++;
        });
        const result = Array.from(map.values()).map(r => ({
          ...r,
          rate: r.total ? Math.round(((r.present + r.late) / r.total) * 100) : 0,
        })).sort((a, b) => a.rate - b.rate);
        setRows(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, className, days]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, r) => ({
      present: acc.present + r.present,
      absent: acc.absent + r.absent,
      late: acc.late + r.late,
      total: acc.total + r.total,
    }), { present: 0, absent: 0, late: 0, total: 0 });
    return { ...t, rate: t.total ? Math.round(((t.present + t.late) / t.total) * 100) : 0 };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Resumo de Presença — {className}
          </DialogTitle>
          <DialogDescription>Últimos {days} dias</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Alunos</div>
            <div className="text-2xl font-bold">{rows.length}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Presenças</div>
            <div className="text-2xl font-bold">{totals.present}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> Atrasos</div>
            <div className="text-2xl font-bold">{totals.late}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> Faltas</div>
            <div className="text-2xl font-bold">{totals.absent}</div>
          </CardContent></Card>
        </div>

        <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
          <span className="text-sm font-medium">Frequência geral da turma</span>
          <Badge className={totals.rate >= 75 ? 'bg-emerald-600' : totals.rate >= 50 ? 'bg-amber-600' : 'bg-destructive'}>
            {totals.rate}%
          </Badge>
        </div>

        <ScrollArea className="flex-1 h-[40vh] border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-center">Pres.</TableHead>
                <TableHead className="text-center">Atr.</TableHead>
                <TableHead className="text-center">Faltas</TableHead>
                <TableHead className="text-center">Frequência</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem alunos ativos</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-center">{r.present}</TableCell>
                  <TableCell className="text-center">{r.late}</TableCell>
                  <TableCell className="text-center">{r.absent}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={r.rate >= 75 ? 'text-emerald-600 border-emerald-600' : r.rate >= 50 ? 'text-amber-600 border-amber-600' : 'text-destructive border-destructive'}>
                      {r.rate}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { onOpenChange(false); navigate(`/students?class=${encodeURIComponent(className || '')}`); }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}