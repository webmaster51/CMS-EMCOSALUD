import nodemailer from 'nodemailer';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const env = getEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const env = getEnv();
  try {
    await getTransporter().sendMail({ from: env.MAIL_FROM, ...message });
    logger.info({ to: message.to, subject: message.subject }, 'correo enviado');
  } catch (err) {
    logger.error({ err, to: message.to }, 'fallo al enviar correo');
    throw err;
  }
}
