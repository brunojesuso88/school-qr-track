import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Plus, Ban, Pencil, Paperclip, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  DERIVED_STATUS_LABEL,
  derivedStatus,
  durationInDays,
  toDateKey,
  type DerivedCertificateStatus,
} from '@/lib/medicalCertificates/status';
import { StudentMedicalCertificateDialog } from './StudentMedicalCertificateDialog';
import type { MedicalCertificate, MedicalCertificateBasic } from './types';

const STATUS_STYLE: Record<DerivedCertificateStatus, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  future: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  ended: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30 line-through',
};

const fmt = (iso: string) => format(new Date(`${iso}T12:00:00`), 'dd/MM/yyyy');

interface Props {
  studentId: string;
  studentName: string;
}

export const StudentCertificatesTab = ({ studentId, studentName }: Props) => {
  const { userRole } = useAuth();
  const canManage = userRole === 'admin' || userRole === 'direction';
  // Professor vê apenas período/situação. Funcionário (staff) não vê nenhum detalhe.
  const canViewPeriods = canManage || userRole === 'teacher';

  const [full, setFull] = useState<MedicalCertificate[]>([]);
  const [basic, setBasic] = useState<MedicalCertificateBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalCertificate | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<MedicalCertificate | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [legacyCount, setLegacyCount] = useState(0);

  const load = useCallback(async () => {
    if (!canViewPeriods) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (canManage) {

      const [{ data }, { count }] = await Promise.all([
        supabase
          .from('student_medical_certificates')
          .select('*')
          .eq('student_id', studentId)
          .order('start_date', { ascending: false }),
        supabase
          .from('occurrences')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('type', 'medical_certificate'),
      ]);
      setFull((data as MedicalCertificate[]) ?? []);
      setLegacyCount(count ?? 0);
    } else {
      // Professores usam apenas a RPC segura (sem CID/anexo/observações).
      const { data } = await supabase.rpc('get_certificate_coverage', {
        _student_ids: [studentId],
        _start_date: '1900-01-01',
        _end_date: '2999-12-31',
      });
      setBasic(((data as MedicalCertificateBasic[]) ?? []).sort((a, b) => b.start_date.localeCompare(a.start_date)));
    }
    setLoading(false);
  }, [studentId, canManage, canViewPeriods]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from('medical-certificates').createSignedUrl(path, 300);
    if (error || !data) {
      toast.error('Não foi possível abrir o anexo.');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('student_medical_certificates')
      .update({
        status_manual: 'cancelled',
        cancelled_reason: cancelReason.trim() || null,
        cancelled_by: userData?.user?.id ?? null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', cancelTarget.id);
    if (error) {
      toast.error('Não foi possível cancelar o atestado.');
      return;
    }
    toast.success('Atestado cancelado.');
    setCancelTarget(null);
    setCancelReason('');
    void load();
  };

  if (!canViewPeriods) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Lock className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Sem acesso aos detalhes de atestados</p>
        <p className="text-xs mt-1">
          Seu perfil não permite visualizar períodos, códigos CID ou anexos.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
  }

  if (!canManage) {

    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Somente período e situação do atestado são visíveis para o seu perfil.
        </p>
        {basic.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum atestado registrado</p>
          </div>
        ) : (
          basic.map((c) => {
            const status = derivedStatus({ ...c, status_manual: c.status }, toDateKey(new Date()));
            return (
              <Card key={`${c.start_date}-${c.end_date}`}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {fmt(c.start_date)} a {fmt(c.end_date)} · {durationInDays(c.start_date, c.end_date)} dia(s)
                  </span>
                  <Badge variant="outline" className={STATUS_STYLE[status]}>
                    {DERIVED_STATUS_LABEL[status]}
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{full.length} atestado(s) registrado(s)</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Novo atestado
        </Button>
      </div>

      {legacyCount > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md border p-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>Existem {legacyCount} registro(s) antigo(s) de atestado em Ocorrências. Eles permanecem inalterados.</span>
        </div>
      )}

      {full.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum atestado registrado</p>
        </div>
      ) : (
        full.map((c) => {
          const status = derivedStatus(c, toDateKey(new Date()));
          const showCid = revealed.has(c.id);
          return (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">
                      {fmt(c.start_date)} a {fmt(c.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {durationInDays(c.start_date, c.end_date)} dia(s) corrido(s)
                      {c.issuer ? ` · ${c.issuer}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLE[status]}>
                    {DERIVED_STATUS_LABEL[status]}
                  </Badge>
                </div>

                {c.cid_code && (
                  <div className="text-xs">
                    {showCid ? (
                      <span>
                        <strong>CID {c.cid_code}</strong>
                        {c.cid_description ? ` — ${c.cid_description}` : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">CID registrado</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 ml-2"
                      onClick={() =>
                        setRevealed((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                    >
                      {showCid ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {showCid ? 'Ocultar CID' : 'Mostrar CID'}
                    </Button>
                  </div>
                )}

                {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                {status === 'cancelled' && c.cancelled_reason && (
                  <p className="text-xs text-destructive">Motivo do cancelamento: {c.cancelled_reason}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {c.attachment_path && (
                    <Button variant="outline" size="sm" onClick={() => openAttachment(c.attachment_path!)}>
                      <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexo
                    </Button>
                  )}
                  {status !== 'cancelled' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(c);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCancelTarget(c)}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <StudentMedicalCertificateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        studentId={studentId}
        studentName={studentName}
        certificate={editing}
        existing={full}
        onSaved={load}
      />

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar atestado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (opcional)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={500} />
            <Button variant="destructive" className="w-full" onClick={confirmCancel}>
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
