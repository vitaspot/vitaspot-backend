import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const clinicInclude = {
  doctors: true,
  specialties: { include: { specialty: true } }
} satisfies Prisma.ClinicInclude;

export type ClinicSearchFilters = {
  q?: string;
  location?: string;
  city?: string;
  country?: string;
  specialty?: string;
};

export const ClinicService = {
  async getClinics(filters: ClinicSearchFilters, skip: number, take: number) {
    const conditions: Prisma.ClinicWhereInput[] = [];

    if (filters.q) {
      conditions.push({
        OR: [
          { name: { contains: filters.q, mode: 'insensitive' } },
          { description: { contains: filters.q, mode: 'insensitive' } }
        ]
      });
    }

    if (filters.location) {
      const searchLocation = filters.location.split(',')[0].trim();
      if (searchLocation) {
        conditions.push({
          OR: [
            { city: { contains: searchLocation, mode: 'insensitive' } },
            { country: { contains: searchLocation, mode: 'insensitive' } },
            { address: { contains: searchLocation, mode: 'insensitive' } }
          ]
        });
      }
    }

    if (filters.city) {
      conditions.push({ city: { equals: filters.city, mode: 'insensitive' } });
    }

    if (filters.country) {
      conditions.push({ country: { equals: filters.country, mode: 'insensitive' } });
    }

    if (filters.specialty) {
      conditions.push({
        specialties: {
          some: {
            specialty: {
              name: { contains: filters.specialty, mode: 'insensitive' }
            }
          }
        }
      });
    }

    const where: Prisma.ClinicWhereInput = conditions.length > 0
      ? { AND: conditions }
      : {};

    const [items, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        skip,
        take,
        include: clinicInclude,
        orderBy: [{ isSponsored: 'desc' }, { rating: 'desc' }]
      }),
      prisma.clinic.count({ where })
    ]);

    return { items, total };
  },

  getClinicBySlug(slug: string) {
    return prisma.clinic.findUnique({
      where: { slug },
      include: clinicInclude
    });
  }
};
