export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'editor';
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
  createdAt: string;
}
