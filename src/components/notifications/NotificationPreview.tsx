import logoCepans from '@/assets/logo-cepans.png';
import {
  NotificationData,
  STAGE_TITLES,
  buildNotificationBody,
  getResolvedObligations,
  formatDocNumber,
  todayBR,
} from '@/lib/notificationTemplates';

interface Props {
  data: NotificationData;
  docNumber: number;
  docYear: number;
  customBody?: string | null;
}

export function NotificationPreview({ data, docNumber, docYear, customBody }: Props) {
  const stage = STAGE_TITLES[data.stage];
  const body = customBody && customBody.trim() ? customBody : buildNotificationBody(data);
  const obligations = getResolvedObligations(data);

  return (
    <div
      id="notification-preview"
      style={{
        background: '#fff',
        color: '#0B2E59',
        boxShadow: '0 8px 28px rgba(15,23,42,0.12)',
        borderRadius: 4,
        width: '100%',
        maxWidth: 794,
        margin: '0 auto',
        padding: '40px 56px',
        fontFamily: '"Times New Roman", Georgia, serif',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={logoCepans} alt="Brasão CEPANS" style={{ width: 110, height: 110, objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: 1, color: '#0B2E59' }}>ESTADO DO MARANHÃO</div>
          <div style={{ fontSize: 12, letterSpacing: 1, color: '#0B2E59' }}>SECRETARIA DE ESTADO DA EDUCAÇÃO DO MARANHÃO (SEDUC MA)</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D47A1', marginTop: 2 }}>
            CENTRO DE ENSINO PROFESSOR ANTÔNIO NONATO SAMPAIO – CEPANS
          </div>
        </div>
        <div style={{ width: 110 }} />
      </div>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#0D47A1,#C62828)', margin: '14px 0 22px' }} />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0B2E59', letterSpacing: 1 }}>{stage.title}</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{stage.subtitle}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#0B2E59' }}>
          <strong>Documento nº {formatDocNumber(docNumber, docYear)}</strong>
          <span style={{ margin: '0 10px' }}>•</span>
          Coelho Neto/MA, {todayBR()}
        </div>
      </div>

      {/* Body */}
      <div style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', marginBottom: 18 }}>{body}</div>

      {/* Reason */}
      {data.reason?.trim() && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0D47A1', marginBottom: 4 }}>Motivo da notificação</div>
          <div style={{ textAlign: 'justify' }}>{data.reason}</div>
        </div>
      )}

      {/* Obligations */}
      {obligations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0D47A1', marginBottom: 6 }}>
            Obrigações acadêmicas não cumpridas
          </div>
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            {obligations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Turmas */}
      {data.classes_subjects?.trim() && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0D47A1', marginBottom: 4 }}>Turmas / disciplina</div>
          <div>{data.classes_subjects}</div>
        </div>
      )}

      {/* Justificativa */}
      {data.teacher_justification?.trim() && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0D47A1', marginBottom: 4 }}>
            Justificativa apresentada pelo docente
          </div>
          <div style={{ textAlign: 'justify', fontStyle: 'italic' }}>{data.teacher_justification}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #0B2E59', paddingTop: 6, fontSize: 12 }}>
            <strong>Bruno de Jesus Oliveira</strong>
            <div style={{ color: '#475569' }}>Coordenador Pedagógico</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #0B2E59', paddingTop: 6, fontSize: 12 }}>
            <strong>Ciente do(a) professor(a)</strong>
            <div style={{ color: '#475569' }}>Data: ____/____/______</div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 36,
          borderTop: '1px solid #e2e8f0',
          paddingTop: 10,
          textAlign: 'center',
          fontSize: 10,
          color: '#64748b',
          fontStyle: 'italic',
        }}
      >
        Documento de acompanhamento pedagógico-administrativo de uso interno da gestão escolar.
      </div>
    </div>
  );
}