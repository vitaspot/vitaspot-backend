import { env } from './env';

export const envConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  corsOrigins: env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean),
  appName: 'VitaSpot'
};