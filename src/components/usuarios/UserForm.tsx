import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userCreateSchema, type UserCreateInput } from '@/lib/validations/user';
import { TextField, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

interface Props {
  onCancel: () => void;
  onSubmit: (
    values: UserCreateInput,
  ) => Promise<{ fieldErrors?: Record<string, string>; error?: string } | void>;
}

export function UserForm({ onCancel, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { name: '', email: '', password: '', role: 'editor' },
  });

  async function submit(values: UserCreateInput) {
    const result = await onSubmit(values);
    if (result?.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof UserCreateInput, { message: m });
      }
    } else if (result?.error) {
      setError('root', { message: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {errors.root && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      <TextField label="Nombre" required error={errors.name?.message} {...register('name')} />
      <TextField
        label="Correo"
        type="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Contraseña"
        type="text"
        required
        hint="Mínimo 10 caracteres. Comunícasela al usuario de forma segura."
        error={errors.password?.message}
        {...register('password')}
      />
      <SelectField label="Rol" error={errors.role?.message} {...register('role')}>
        <option value="editor">Editor</option>
        <option value="superadmin">Superadministrador</option>
        <option value="document_manager">Gestor de Documentos</option>
        <option value="content_manager">Gestor de Contenido</option>
      </SelectField>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          Crear usuario
        </Button>
      </div>
    </form>
  );
}