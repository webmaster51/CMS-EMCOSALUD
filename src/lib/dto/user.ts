export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'editor' |'document_manager' | 'content_manager';
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
  createdAt: string;
}
