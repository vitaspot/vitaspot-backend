import 'dotenv/config';
import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();

// Autorise spécifiquement votre frontend à communiquer avec ce backend
app.use(cors());
app.use(express.json());

// Configuration sécurisée Namecheap
const smtpHost = process.env.SMTP_HOST || 'mail.privateemail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER || 'contact@myvitaspot.com';
const smtpPass = process.env.SMTP_PASS;

if (!smtpPass) {
  throw new Error('La variable SMTP_PASS doit être définie dans l’environnement.');
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

// Route API Contact repensée
app.post('/api/contact', async (req: Request, res: Response): Promise<void> => {
  const { nom, prenom, email, objet, message } = req.body;

  try {
    await transporter.sendMail({
      from: `"Serveur VitaSpot" <${smtpUser}>`,
      to: 'contact@myvitaspot.com', // Cible fixe et sécurisée
      replyTo: email,
      subject: `VitaSpot - ${objet} (de ${prenom} ${nom})`,
      text: `Nouveau message de : ${prenom} ${nom}\nEmail du contact : ${email}\n\nObjet sélectionné : ${objet}\n\nMessage :\n${message}`,
    });
    
    res.status(200).json({ success: true, message: 'Email envoyé avec succès.' });
  } catch (error) {
    console.error('Erreur SMTP:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi.' });
  }
});

// Port d'écoute pour Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});