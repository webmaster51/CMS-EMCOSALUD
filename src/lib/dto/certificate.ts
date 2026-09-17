export interface CertificateDTO {
  id: number;
  companyId: number;
  companyName: string;
  taxYear: number;
  documentNumber: string;
  fullName: string | null;
  pdfMediaId: string;
  pdfUrl: string | null;
  pdfName?: string | null;      // <-- Nombre del PDF (ej: 10540101_Certificado.pdf)
  description?: string | null;  // <-- Nombre/Descripción del lote o periodo
  status: 'active' | 'inactive';
  issuedDate: string | null;
  createdAt: string;
}

export interface BulkJobDTO {
  id: string;
  kind: 'multi_pdf' | 'zip' | 'csv_zip';
  companyName: string;
  taxYear: number;
  status:
    | 'queued'
    | 'processing'
    | 'completed'
    | 'completed_with_errors'
    | 'failed';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errorReportUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BulkItemDTO {
  id: number;
  sourceFilename: string;
  detectedDocument: string | null;
  detectedYear: number | null;
  status: 'pending' | 'ok' | 'error' | 'skipped';
  errorMessage: string | null;
}

export interface FilenamePatternDTO {
  id: number;
  name: string;
  regex: string;
  nameGroup?: string | null;
  documentGroup: string;
  yearGroup: string | null;
  isDefault: boolean;
  enabled: boolean;
}
