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

const specialtyFilters: Record<string, string[]> = {
  all: [
    'nwr["amenity"~"clinic|hospital|doctors|dentist|pharmacy"]',
    'nwr["healthcare"~"doctor|clinic|laboratory"]'
  ],
  general: [
    'nwr["healthcare:speciality"="general"]',
    'nwr["healthcare"="doctor"]',
    'nwr["amenity"="doctors"]'
  ],
  cardiology: ['nwr["healthcare:speciality"="cardiology"]'],
  dermatology: ['nwr["healthcare:speciality"="dermatology"]'],
  paediatrics: ['nwr["healthcare:speciality"="paediatrics"]'],
  gynaecology: ['nwr["healthcare:speciality"="gynaecology"]'],
  ophthalmology: ['nwr["healthcare:speciality"="ophthalmology"]'],
  neurology: ['nwr["healthcare:speciality"="neurology"]'],
  dentist: ['nwr["amenity"="dentist"]'],
  clinic: ['nwr["amenity"="clinic"]'],
  hospital: ['nwr["amenity"="hospital"]'],
  laboratory: ['nwr["healthcare"="laboratory"]'],
  physiotherapist: ['nwr["healthcare"="physiotherapist"]'],
  nurse: ['nwr["healthcare"="nurse"]'],
  psychologist: ['nwr["healthcare"="psychotherapist"]'],
  speech_therapist: ['nwr["healthcare"="speech_therapist"]'],
  podiatrist: ['nwr["healthcare"="podiatrist"]'],
  radiology: ['nwr["healthcare:speciality"="radiology"]']
};

// Route de recherche d'établissements de santé (avec serveurs miroirs anti-panne)
app.get('/api/clinics', async (req: Request, res: Response): Promise<void> => {
  const { lat, lon, specialty } = req.query;
  const latitude = typeof lat === 'string' ? Number(lat) : NaN;
  const longitude = typeof lon === 'string' ? Number(lon) : NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: 'Coordonnées GPS manquantes ou invalides' });
    return;
  }

  if (specialty !== undefined && (typeof specialty !== 'string' || !/^[a-z0-9_]{1,40}$/i.test(specialty))) {
    res.status(400).json({ error: 'Spécialité invalide' });
    return;
  }

  const selectedSpecialty = typeof specialty === 'string' ? specialty : 'all';
  if (!Object.prototype.hasOwnProperty.call(specialtyFilters, selectedSpecialty)) {
    res.status(400).json({ error: 'Spécialité invalide' });
    return;
  }
  const queryFilters = specialtyFilters[selectedSpecialty]
    .map((filter) => `${filter}(around:5000,${latitude},${longitude});`)
    .join('\n');

  const overpassQuery = `
    [out:json][timeout:15];
    (${queryFilters});
    out center 40;
  `;

  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  for (const serverUrl of mirrors) {
    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`
      });

      if (response.ok) {
        const data = await response.json();
        const clinics = (data.elements || []).map((el: any) => ({
          id: el.id,
          name: el.tags?.name || 'Établissement de santé',
          type: el.tags?.amenity || 'clinic',
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
          phone: el.tags?.phone || el.tags?.['contact:phone'] || 'Non renseigné',
          whatsapp: el.tags?.whatsapp || el.tags?.['contact:whatsapp'] || null,
          address: [el.tags?.['addr:housenumber'], el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(' ') || 'Adresse sur carte',
          website: el.tags?.website || el.tags?.['contact:website'] || null
        }));

        res.status(200).json({ clinics });
        return;
      }
    } catch (err) {
      console.warn(`Échec sur ${serverUrl}, tentative suivante...`);
    }
  }

  res.status(503).json({ error: 'Les serveurs cartographiques sont momentanément saturés.' });
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