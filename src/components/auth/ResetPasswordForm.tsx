import { useState } from 'react';
import { authClient } from '@/lib/auth/client';

interface Props {
  token: string;
}

export default function ResetPasswordForm({ token }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setError(error.message ?? 'El enlace no es válido o expiró.');
      setLoading(false);
      return;
    }
    window.location.href = '/login';
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="space-y-4"
    >
      <h1 className="text-lg font-semibold text-slate-900">Nueva contraseña</h1>
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Contraseña (mín. 10)</span>
        <input
          type="password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Repetir contraseña</span>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
