import { pino } from 'pino';
import { getEnv } from '@/lib/env';

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  base: { app: 'emcosalud-cms' },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.keyHash'],
});

export type Logger = typeof logger;
