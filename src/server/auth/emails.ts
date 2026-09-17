import type { MailMessage } from '@/lib/mailer';

const wrap = (title: string, body: string): string => `
<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
          <tr><td style="background:#1d3c7a;padding:20px 28px;color:#fff;font-weight:700;font-size:16px">
            CMS EMCO SALUD
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:18px">${title}</h1>
            ${body}
          </td></tr>
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:16px">
          EMCO SALUD — Grupo Empresarial. Si no solicitaste esto, ignora este correo.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;

export function resetPasswordEmail(to: string, url: string): MailMessage {
  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">
      Recibimos una solicitud para restablecer tu contraseña. El enlace expira en 1 hora.
    </p>
    <p style="margin:0 0 24px">
      <a href="${url}" style="display:inline-block;background:#1d3c7a;color:#fff;text-decoration:none;
         padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600">
        Restablecer contraseña
      </a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;word-break:break-all">${url}</p>`;
  return {
    to,
    subject: 'Restablece tu contraseña — CMS EMCO SALUD',
    html: wrap('Restablecer contraseña', body),
    text: `Restablece tu contraseña (expira en 1 hora): ${url}`,
  };
}
