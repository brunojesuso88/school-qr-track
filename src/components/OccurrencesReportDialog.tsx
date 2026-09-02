import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSchoolName } from '@/hooks/useSchoolName';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import { NO_ACTIVE_SCHOOL_MESSAGE } from '@/lib/schools/scope';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CLASS_COUNCIL_TYPE,
  councilPresetLabel,
  normalizeCouncilItems,
} from '@/lib/occurrences/councilPresets';

type ReportScope = 'general' | 'council' | 'all';

const OCCURRENCE_LABELS: Record<string, string> = {
  early_leave: 'Saída Antecipada',
  illness: 'Doença',
  medical_certificate: 'Atestado Médico',
  late_arrival: 'Atraso',
  discipline: 'Ocorrência Disciplinar',
  class_council: 'Conselho de Classe',
  other: 'Outros',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

interface OccurrenceRow {
  id: string;
  type: string;
  description: string | null;
  date: string;
  end_date: string | null;
  teacher_name: string | null;
  council_items: string[] | null;
  students: {
    full_name: string;
    student_id: string;
    class: string;
    shift: string;
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOPE_TITLES: Record<ReportScope, string> = {
  general: 'Relatório de Ocorrências Gerais',
  council: 'Relatório de Conselho de Classe',
  all: 'Relatório de Ocorrências',
};

const SCOPE_FILES: Record<ReportScope, string> = {
  general: 'ocorrencias_gerais',
  council: 'conselho_de_classe',
  all: 'ocorrencias',
};

const fmt = (d: string) => format(parse(d, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');

export const OccurrencesReportDialog = ({ open, onOpenChange }: Props) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [generating, setGenerating] = useState(false);
  const [scope, setScope] = useState<ReportScope>('all');
  const { schoolName } = useSchoolName();
  const activeSchoolId = useActiveSchoolId();

  const handleGenerate = async () => {
    if (!date) {
      toast.error('Selecione uma data');
      return;
    }
    if (!activeSchoolId) {
      toast.error(NO_ACTIVE_SCHOOL_MESSAGE);
      return;
    }
    setGenerating(true);
    try {
      const target = format(date, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('occurrences')
        .select('id, type, description, date, end_date, teacher_name, council_items, students(full_name, student_id, class, shift)')
        .eq('school_id', activeSchoolId)
        .or(`date.eq.${target},and(date.lte.${target},end_date.gte.${target})`)
        .order('date');

      if (error) throw error;

      const all = (data || []) as unknown as OccurrenceRow[];
      const rows = all.filter((r) => {
        if (scope === 'council') return r.type === CLASS_COUNCIL_TYPE;
        if (scope === 'general') return r.type !== CLASS_COUNCIL_TYPE;
        return true;
      });

      if (rows.length === 0) {
        toast.error(`Nenhum registro encontrado em ${format(date, 'dd/MM/yyyy')}`);
        return;
      }

      // Agrupar por turma
      const groups = new Map<string, OccurrenceRow[]>();
      rows.forEach((r) => {
        const key = r.students?.class || 'Sem turma';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });
      const sortedClasses = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 12;

      doc.setFontSize(12);
      doc.text(schoolName || 'Escola', pageWidth / 2, 14, { align: 'center' });
      doc.setFontSize(14);
      doc.text(SCOPE_TITLES[scope], pageWidth / 2, 21, { align: 'center' });
      doc.setFontSize(10);
      doc.text(
        `Data: ${format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR })}  •  Total: ${rows.length} registro(s)`,
        pageWidth / 2,
        28,
        { align: 'center' }
      );

      let cursorY = 36;

      sortedClasses.forEach((className) => {
        const items = groups.get(className)!;
        const shift = items[0]?.students?.shift;
        const shiftLabel = shift ? SHIFT_LABELS[shift] || shift : '';

        doc.setFontSize(11);
        doc.text(
          `Turma: ${className}${shiftLabel ? ` — ${shiftLabel}` : ''} (${items.length})`,
          margin,
          cursorY
        );
        cursorY += 2;

        const councilOnly = scope === 'council';

        autoTable(doc, {
          startY: cursorY + 2,
          head: councilOnly
            ? [['Aluno', 'Matrícula', 'Apontamentos do conselho', 'Registrado por', 'Observação']]
            : [['Aluno', 'Matrícula', 'Tipo', 'Registrado por', 'Descrição']],
          body: items
            .sort((a, b) => (a.students?.full_name || '').localeCompare(b.students?.full_name || '', 'pt-BR'))
            .map((o) => {
              const typeLabel = OCCURRENCE_LABELS[o.type] || o.type;
              const period =
                o.type === 'medical_certificate' && o.end_date
                  ? ` (${fmt(o.date)} a ${fmt(o.end_date)})`
                  : '';
              const presets = normalizeCouncilItems(o.council_items)
                .map((k) => councilPresetLabel(k))
                .join('; ');
              return [
                o.students?.full_name || 'Aluno não encontrado',
                o.students?.student_id || '-',
                councilOnly ? (presets || '-') : `${typeLabel}${period}`,
                o.teacher_name || '-',
                o.description || '-',
              ];
            }),
          theme: 'grid',
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak' },
          headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'left' },
          columnStyles: {
            0: { cellWidth: 42 },
            1: { cellWidth: 24 },
            2: { cellWidth: 34 },
            3: { cellWidth: 32 },
            4: { cellWidth: 'auto' },
          },
        });

        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      });

      // Rodapé com paginação
      const pageCount = doc.getNumberOfPages();
      const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.text(
          `Emitido em ${generatedAt}`,
          margin,
          doc.internal.pageSize.getHeight() - 8
        );
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth - margin,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' }
        );
      }

      doc.save(`${SCOPE_FILES[scope]}_${target}.pdf`);
      toast.success('Relatório gerado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating occurrences report:', error);
      toast.error('Erro ao gerar o relatório');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Ocorrências</DialogTitle>
          <DialogDescription>
            Escolha uma data para gerar o PDF das ocorrências do dia, organizado por turma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Escopo do relatório</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as ReportScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Ocorrências gerais</SelectItem>
              <SelectItem value="council">Conselho de Classe</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Data do relatório</Label>
          <div className="flex justify-center rounded-md border">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </div>
          {date && (
            <p className="text-sm text-muted-foreground">
              Selecionado: {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !date}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OccurrencesReportDialog;