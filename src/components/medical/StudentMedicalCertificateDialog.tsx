import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2, Search, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  areDatesValid,
  durationInDays,
  findActiveOverlap,
  OVERLAP_MESSAGE,
  toDateKey,
} from '@/lib/medicalCertificates/status';
import {
  CID_DISCLAIMER,
  isValidCid,
  lookupCid,
  normalizeCid,
  type CidSource,
} from '@/lib/medicalCertificates/cidLookup';
import type { MedicalCertificate } from './types';

const BUCKET = 'medical-certificates';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  certificate?: MedicalCertificate | null;
  existing: MedicalCertificate[];
  onSaved: () => void;
}

export const StudentMedicalCertificateDialog = ({
  open,
  onClose,
  studentId,
  studentName,
  certificate,
  existing,
  onSaved,
}: Props) => {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [cidCode, setCidCode] = useState('');
  const [cidDescription, setCidDescription] = useState('');
  const [cidSource, setCidSource] = useState<CidSource | null>(null);
  const [suggestion, setSuggestion] = useState<{ description: string; simple: string | null; source: CidSource } | null>(null);
  const [searching, setSearching] = useState(false);
  const [notes, setNotes] = useState('');
  const [issuer, setIssuer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(certificate ? new Date(`${certificate.start_date}T12:00:00`) : new Date());
    setEndDate(certificate ? new Date(`${certificate.end_date}T12:00:00`) : undefined);
    setCidCode(certificate?.cid_code ?? '');
    setCidDescription(certificate?.cid_description ?? '');
    setCidSource((certificate?.cid_source as CidSource) ?? null);
    setNotes(certificate?.notes ?? '');
    setIssuer(certificate?.issuer ?? '');
    setSuggestion(null);
    setFile(null);
  }, [open, certificate]);

  const handleSearchCid = async () => {
    const code = normalizeCid(cidCode);
    setCidCode(code);
    if (!isValidCid(code)) {
      toast.error('Código CID inválido. Use o formato A00 ou A00.0.');
      return;
    }
    setSearching(true);
    setSuggestion(null);
    try {
      const result = await lookupCid(code);
      if (result.status === 'ok' && result.description) {
        setSuggestion({
          description: result.description,
          simple: result.simple_explanation,
          source: result.source ?? 'ai',
        });
      } else {
        toast.info('Não foi possível identificar esse código com segurança. Você pode preencher a descrição manualmente.');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Informe a data inicial e a data final.');
      return;
    }
    const start = toDateKey(startDate);
    const end = toDateKey(endDate);
    if (!areDatesValid(start, end)) {
      toast.error('A data final deve ser igual ou posterior à data inicial.');
      return;
    }
    const overlap = findActiveOverlap(existing, { start_date: start, end_date: end, id: certificate?.id });
    if (overlap) {
      toast.error(OVERLAP_MESSAGE);
      return;
    }
    const code = cidCode ? normalizeCid(cidCode) : null;
    if (code && !isValidCid(code)) {
      toast.error('Código CID inválido. Use o formato A00 ou A00.0.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        student_id: studentId,
        start_date: start,
        end_date: end,
        cid_code: code,
        cid_description: cidDescription.trim() ? cidDescription.trim().slice(0, 300) : null,
        cid_source: cidDescription.trim() ? cidSource ?? 'manual' : null,
        notes: notes.trim() ? notes.trim().slice(0, 500) : null,
        issuer: issuer.trim() ? issuer.trim().slice(0, 200) : null,
      };

      let certificateId = certificate?.id;
      if (certificateId) {
        const { error } = await supabase
          .from('student_medical_certificates')
          .update(payload)
          .eq('id', certificateId);
        if (error) throw error;
      } else if (restrictedCreate) {
        // Professor não possui SELECT nem UPDATE: id gerado no cliente e insert sem retorno.
        certificateId = crypto.randomUUID();
        const { error } = await supabase
          .from('student_medical_certificates')
          .insert({
            ...payload,
            id: certificateId,
            status_manual: 'active',
            created_by: userData?.user?.id ?? null,
          });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('student_medical_certificates')
          .insert({ ...payload, created_by: userData?.user?.id ?? null })
          .select('id')
          .single();
        if (error) throw error;
        certificateId = data.id;
      }

      if (file && certificateId) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error('Anexo deve ser PDF, JPG ou PNG.');
        } else if (file.size > MAX_FILE_SIZE) {
          toast.error('Anexo maior que 10MB.');
        } else {
          const ext = file.name.split('.').pop() ?? 'bin';
          const path = restrictedCreate
            ? `${studentId}/${certificateId}/atestado-${Date.now()}.${ext}`
            : `${studentId}/${certificateId}/atestado.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            // Professor não tem UPDATE de storage: upload sem upsert em path único.
            .upload(path, file, { upsert: !restrictedCreate, contentType: file.type });
          if (upErr) {
            toast.error('Não foi possível enviar o anexo.');
          } else if (!restrictedCreate) {
            await supabase
              .from('student_medical_certificates')
              .update({ attachment_path: path })
              .eq('id', certificateId);
          }
        }
      }


      toast.success(certificate ? 'Atestado atualizado.' : 'Atestado cadastrado.');
      onSaved();
      onClose();
    } catch (err) {
      // PostgrestError não é `instanceof Error`: extrai `message` do objeto.
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : typeof err === 'string'
              ? err
              : '';
      const code =
        typeof err === 'object' && err !== null ? String((err as { code?: unknown }).code ?? '') : '';
      const isOverlap = code === '23505' || /atestado ativo/i.test(raw);
      toast.error(isOverlap ? OVERLAP_MESSAGE : raw || 'Erro ao salvar atestado');

    } finally {
      setSaving(false);
    }
  };

  const days = startDate && endDate ? durationInDays(toDateKey(startDate), toDateKey(endDate)) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{certificate ? 'Editar atestado' : 'Novo atestado'}</DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : <span className="text-muted-foreground">Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    locale={ptBR}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : <span className="text-muted-foreground">Selecione</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    locale={ptBR}
                    initialFocus
                    disabled={(date) => (startDate ? date < startDate : false)}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {days > 0 && (
            <p className="text-xs text-muted-foreground">Duração: {days} dia(s) corrido(s).</p>
          )}

          <div className="space-y-2">
            <Label>CID (opcional)</Label>
            <div className="flex gap-2">
              <Input
                value={cidCode}
                onChange={(e) => setCidCode(e.target.value.toUpperCase())}
                placeholder="Ex.: J11 ou M54.5"
                maxLength={10}
              />
              <Button type="button" variant="outline" onClick={handleSearchCid} disabled={searching || !cidCode}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Pesquisar CID</span>
              </Button>
            </div>
            {suggestion && (
              <div className="rounded-md border p-3 space-y-2 bg-muted/40">
                <p className="text-sm font-medium">{suggestion.description}</p>
                {suggestion.simple && <p className="text-xs text-muted-foreground">{suggestion.simple}</p>}
                <p className="text-[11px] text-muted-foreground">{CID_DISCLAIMER}</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCidDescription(suggestion.description);
                    setCidSource(suggestion.source);
                    setSuggestion(null);
                  }}
                >
                  Usar esta descrição
                </Button>
              </div>
            )}
            <Input
              value={cidDescription}
              onChange={(e) => {
                setCidDescription(e.target.value);
                setCidSource('manual');
              }}
              placeholder="Descrição do CID (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Emissor / unidade (opcional)</Label>
            <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} maxLength={200} placeholder="Ex.: UBS Central" />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Anexo (opcional — PDF, JPG ou PNG até 10MB)
            </Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving || !startDate || !endDate}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {certificate ? 'Salvar alterações' : 'Cadastrar atestado'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
