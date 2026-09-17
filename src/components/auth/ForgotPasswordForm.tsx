import { useState } from 'react';
import { authClient } from '@/lib/auth/client';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    // No revelamos si el correo existe: siempre mostramos confirmación.
    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <p className="text-sm text-slate-600">
        Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
        Revisa tu bandeja de entrada.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="space-y-4"
    >
      <h1 className="text-lg font-semibold text-slate-900">Recuperar contraseña</h1>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Correo</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <a href="/login" className="block text-center text-sm text-brand-600 hover:underline">
        Volver a iniciar sesión
      </a>
    </form>
  );
}
