export interface CompanyDTO {
  id: number;
  name: string;
  shortName: string;
  taxId: string;
  description: string | null;
  status: 'active' | 'inactive';
  logoMediaId: string | null;
  logoUrl: string | null;
  certificateCount: number;
  createdAt: string;
  updatedAt: string;
}
