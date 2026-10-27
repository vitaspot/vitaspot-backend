import { BadgeType, ClinicStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const specialties = [
  { name: 'Dentisterie', slug: 'dentisterie' },
  { name: 'Ophtalmologie', slug: 'ophtalmologie' },
  { name: 'Chirurgie esthétique', slug: 'chirurgie-esthetique' }
];

type SeedClinic = {
  slug: string;
  name: string;
  country: string;
  city: string;
  description: string;
  rating: number;
  reviewsCount: number;
  latitude: number;
  longitude: number;
  specialtySlugs: string[];
  doctors: { name: string; specialty: string; qualification: string }[];
};

const clinics: SeedClinic[] = [
  {
    slug: 'vitaspot-demo-dentaire-istanbul',
    name: 'VitaSpot Démo - Centre dentaire Istanbul',
    country: 'Turquie',
    city: 'Istanbul',
    description: 'Fiche et avis fictifs destinés uniquement aux tests de développement.',
    rating: 4.8,
    reviewsCount: 42,
    latitude: 41.0082,
    longitude: 28.9784,
    specialtySlugs: ['dentisterie'],
    doctors: [
      { name: 'Dr Démo Dentaire', specialty: 'Dentisterie', qualification: 'Profil fictif de démonstration' }
    ]
  },
  {
    slug: 'vitaspot-demo-ophtalmologie-casablanca',
    name: 'VitaSpot Démo - Centre ophtalmologique Casablanca',
    country: 'Maroc',
    city: 'Casablanca',
    description: 'Fiche et avis fictifs destinés uniquement aux tests de développement.',
    rating: 4.6,
    reviewsCount: 28,
    latitude: 33.5731,
    longitude: -7.5898,
    specialtySlugs: ['ophtalmologie'],
    doctors: [
      { name: 'Dr Démo Ophtalmologie', specialty: 'Ophtalmologie', qualification: 'Profil fictif de démonstration' }
    ]
  },
  {
    slug: 'vitaspot-demo-esthetique-barcelone',
    name: 'VitaSpot Démo - Centre esthétique Barcelone',
    country: 'Espagne',
    city: 'Barcelone',
    description: 'Fiche et avis fictifs destinés uniquement aux tests de développement.',
    rating: 4.7,
    reviewsCount: 35,
    latitude: 41.3874,
    longitude: 2.1686,
    specialtySlugs: ['chirurgie-esthetique'],
    doctors: [
      { name: 'Dr Démo Esthétique', specialty: 'Chirurgie esthétique', qualification: 'Profil fictif de démonstration' }
    ]
  }
];

async function main() {
  for (const specialty of specialties) {
    await prisma.specialty.upsert({
      where: { slug: specialty.slug },
      update: { name: specialty.name },
      create: specialty
    });
  }

  for (const clinic of clinics) {
    const specialtyLinks = clinic.specialtySlugs.map(slug => ({
      specialty: { connect: { slug } }
    }));

    const clinicData = {
      name: clinic.name,
      country: clinic.country,
      city: clinic.city,
      description: clinic.description,
      rating: clinic.rating,
      reviewsCount: clinic.reviewsCount,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      badges: [BadgeType.NEW],
      status: ClinicStatus.PUBLISHED
    };

    await prisma.clinic.upsert({
      where: { slug: clinic.slug },
      create: {
        ...clinicData,
        slug: clinic.slug,
        specialties: { create: specialtyLinks },
        doctors: { create: clinic.doctors }
      },
      update: {
        ...clinicData,
        specialties: { deleteMany: {}, create: specialtyLinks },
        doctors: { deleteMany: {}, create: clinic.doctors }
      }
    });
  }

  const [seededSpecialties, seededClinics] = await Promise.all([
    prisma.specialty.count({ where: { slug: { in: specialties.map(specialty => specialty.slug) } } }),
    prisma.clinic.count({ where: { slug: { in: clinics.map(clinic => clinic.slug) } } })
  ]);

  console.log(`Seed terminé : ${seededSpecialties} spécialités et ${seededClinics} cliniques de démonstration en base.`);
}

main()
  .catch(error => {
    console.error('Échec du seed Prisma :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });