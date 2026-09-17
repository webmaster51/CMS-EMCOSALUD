import { useState } from 'react';
import { signIn } from '@/lib/auth/client';

interface Props {
  next?: string;
  notice?: string | null;
}

const TOO_MANY = 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  INVALID_EMAIL: 'El correo no es válido.',
  USER_NOT_FOUND: 'Correo o contraseña incorrectos.',
  BANNED_USER: 'Tu cuenta está suspendida. Contacta a un administrador.',
  TOO_MANY_REQUESTS: TOO_MANY,
};

export default function LoginForm({ next = '/admin', notice }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await signIn.email({ email, password, rememberMe: remember });
    if (error) {
      const code = error.code ?? '';
      const message =
        ERROR_MESSAGES[code] ??
        (error.status === 429
          ? TOO_MANY
          : (error.message ?? 'No fue posible iniciar sesión.'));
      setError(message);
      setLoading(false);
      return;
    }
    window.location.href = next;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
      className="space-y-4"
    >
      <h1 className="text-lg font-semibold text-slate-900">Iniciar sesión</h1>

      {notice && (
        <p className="rounded-md bg-info-bg px-3 py-2 text-sm text-info">{notice}</p>
      )}
      {error && (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Correo</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Contraseña</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Recordar sesión
        </label>
        <a href="/forgot-password" className="text-brand-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </a>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
