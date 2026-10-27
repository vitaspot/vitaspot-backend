import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import clinicsRouter from './modules/clinics/clinics.routes';

const app = express();
const apiPrefix = '/api/v1';

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
}));

app.get('/health', (_req, res) => res.json({ success: true }));
app.use(express.json());
app.use(`${apiPrefix}/clinics`, clinicsRouter);

app.listen(env.PORT, () => {
  console.log(`VitaSpot API disponible sur http://localhost:${env.PORT}`);
});