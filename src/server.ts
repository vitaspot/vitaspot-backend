import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();

// Autorise spécifiquement votre frontend à communiquer avec ce backend
app.use(cors());
app.use(express.json());

// Configuration sécurisée Namecheap
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Route API Contact repensée
app.post('/api/contact', async (req: Request, res: Response): Promise<void> => {
  const { nom, prenom, email, objet, message } = req.body;

  try {
    await transporter.sendMail({
      from: `"Serveur VitaSpot" <${process.env.SMTP_USER}>`,
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