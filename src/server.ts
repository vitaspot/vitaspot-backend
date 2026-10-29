import cors from 'cors';
import express from 'express';
import { Request, Response } from 'express';
import helmet from 'helmet';
import nodemailer from 'nodemailer';
import { env } from './config/env';
import clinicsRouter from './modules/clinics/clinics.routes';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app = express();
const apiPrefix = '/api/v1';

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
}));

app.get('/health', (_req, res) => res.json({ success: true }));
app.use(express.json());
app.use(`${apiPrefix}/clinics`, clinicsRouter);

app.post('/api/contact', async (req: Request, res: Response): Promise<void> => {
  const { nom, email, message, type } = req.body;

  const sujet = type === 'devis'
    ? `Nouveau Devis VitaSpot de ${nom}`
    : `Nouveau Message VitaSpot de ${nom}`;

  try {
    await transporter.sendMail({
      from: `"Serveur VitaSpot" <${process.env.SMTP_USER}>`,
      to: 'contact@myvitaspot.com',
      replyTo: email,
      subject: sujet,
      text: `Nom: ${nom}\nEmail: ${email}\n\nMessage / Détails du devis:\n${message}`,
    });

    res.status(200).json({ success: true, message: 'Email envoyé avec succès.' });
  } catch (error) {
    console.error('Erreur SMTP:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi.' });
  }
});

app.listen(env.PORT, () => {
  console.log(`VitaSpot API disponible sur http://localhost:${env.PORT}`);
});