export interface MedicalCertificate {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  cid_code: string | null;
  cid_description: string | null;
  cid_source: string | null;
  notes: string | null;
  issuer: string | null;
  attachment_path: string | null;
  status_manual: string;
  cancelled_reason: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** Visão restrita usada por professores: sem CID, notas, emissor ou anexo. */
export interface MedicalCertificateBasic {
  student_id: string;
  start_date: string;
  end_date: string;
  status: string;
}
