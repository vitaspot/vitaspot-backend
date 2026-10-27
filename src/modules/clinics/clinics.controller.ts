import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getClinics = async (req: Request, res: Response) => {
  try {
    const { q, location, city, country, specialty, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // 1. REQUÊTE LOCALE (Vos données PostgreSQL)
    const where: any = {};
    const andConditions: any[] = [];

    if (q) andConditions.push({
      OR: [
        { name: { contains: q as string, mode: 'insensitive' } },
        { description: { contains: q as string, mode: 'insensitive' } }
      ]
    });

    if (location) {
      const searchLoc = (location as string).split(',')[0].trim();
      andConditions.push({
        OR: [
          { city: { contains: searchLoc, mode: 'insensitive' } },
          { country: { contains: searchLoc, mode: 'insensitive' } },
          { address: { contains: searchLoc, mode: 'insensitive' } }
        ]
      });
    }

    if (specialty) andConditions.push({
      specialties: { some: { specialty: { name: { contains: specialty as string, mode: 'insensitive' } } } }
    });

    if (andConditions.length > 0) where.AND = andConditions;

    const [items, total] = await Promise.all([
      prisma.clinic.findMany({
        where, skip, take: limitNum,
        include: { doctors: true, specialties: { include: { specialty: true } } },
        orderBy: [{ isSponsored: 'desc' }, { rating: 'desc' }]
      }),
      prisma.clinic.count({ where })
    ]);

    const user = (req as any).user;
    const hasPass = user?.hasPremiumPass || false;

    let localData = items.map(c => ({
      ...c,
      specialties: c.specialties.map(s => s.specialty.name),
      phone: hasPass ? c.phone : undefined,
      whatsapp: hasPass ? c.whatsapp : undefined,
      address: hasPass ? c.address : undefined
    }));

    // 2. REQUÊTE EXTERNE (OpenStreetMap avec sécurité maximale)
    let osmClinics: any[] = [];

    if (location) {
      try {
        const exactLocation = location as string;
        const cityName = exactLocation.split(',')[0].trim();
        
        // IDENTITÉ OBLIGATOIRE POUR NE PLUS ÊTRE BLOQUÉ
        const headers = { 
          'User-Agent': 'VitaSpot-Medical-Directory/1.0 (contact@vitaspot.com)',
          'Accept': 'application/json'
        };
        
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(exactLocation)}`, { headers });
        
        if (geoRes.ok) {
          const geoData = await geoRes.json();

          if (geoData && geoData.length > 0) {
            const lat = parseFloat(geoData[0].lat);
            const lon = parseFloat(geoData[0].lon);

            // TIMEOUT STRICT RÉDUIT À 5 SECONDES pour éviter que le navigateur n'abandonne
            const overpassQuery = `
              [out:json][timeout:5];
              (
                nwr["amenity"~"clinic|hospital|doctors"](around:5000, ${lat}, ${lon});
                nwr["healthcare"~"clinic|hospital|doctor"](around:5000, ${lat}, ${lon});
              );
              out center;
            `;

            const overpassRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, { headers });
            
            if (overpassRes.ok) {
              const overpassData = await overpassRes.json();

              osmClinics = overpassData.elements.map((el: any) => {
                let typeEtablissement = "Centre Médical";
                if (el.tags?.amenity === "hospital") typeEtablissement = "Hôpital";
                if (el.tags?.amenity === "clinic") typeEtablissement = "Clinique";

                const elementLat = el.lat || el.center?.lat;
                const elementLon = el.lon || el.center?.lon;

                return {
                  id: `osm-${el.id}`,
                  slug: `osm-${el.id}`,
                  name: el.tags?.name || typeEtablissement,
                  country: "Source : OpenStreetMap",
                  city: cityName,
                  address: el.tags?.['addr:street'] ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}` : "Adresse disponible sur place",
                  phone: el.tags?.phone || null,
                  specialties: [el.tags?.healthcare || "Généraliste", typeEtablissement],
                  latitude: parseFloat(elementLat),
                  longitude: parseFloat(elementLon),
                  rating: 0,
                  reviewsCount: 0,
                  isSponsored: false,
                  badges: []
                };
              });

              // Application des filtres de spécialité et recherche
              const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
              const searchFilter = q ? normalizeText(q as string) : null;
              const specialtyFilter = specialty ? normalizeText(specialty as string) : null;

              if (searchFilter || specialtyFilter) {
                osmClinics = osmClinics.filter(c => {
                  const matchQuery = searchFilter ? 
                    (normalizeText(c.name).includes(searchFilter) || c.specialties.some((s: string) => normalizeText(s).includes(searchFilter))) : true;
                  const matchSpecialty = specialtyFilter ? 
                    c.specialties.some((s: string) => normalizeText(s).includes(specialtyFilter)) : true;
                  return matchQuery && matchSpecialty;
                });
              }
            }
          }
        }
      } catch (osmError) {
        // En cas de lenteur d'OSM, on l'ignore silencieusement au lieu de faire planter toute la page
        console.warn("OpenStreetMap indisponible temporairement, affichage des données locales uniquement.");
      }
    }

    // 3. FUSION ET RÉPONSE
    const combinedData = [...localData, ...osmClinics];

    return res.json({
      success: true,
      data: combinedData,
      meta: { 
        total: total + osmClinics.length, 
        page: pageNum, 
        limit: limitNum, 
        totalPages: Math.ceil((total + osmClinics.length) / limitNum) 
      }
    });

  } catch (globalError) {
    // Ce bloc garantit que l'API ne crashera jamais violemment.
    console.error("Erreur globale dans la recherche :", globalError);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur lors de la recherche." });
  }
};
// --- FONCTIONS RESTAURÉES POUR ÉVITER L'ERREUR UNDEFINED ---

export const getClinicBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const clinic = await prisma.clinic.findUnique({
      where: { slug: slug as string },
      include: { doctors: true, specialties: { include: { specialty: true } } }
    });
    
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinique non trouvée' });
    return res.json({ success: true, data: clinic });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const getClinicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const clinic = await prisma.clinic.findUnique({
      where: { id: id as string },
      include: { doctors: true, specialties: { include: { specialty: true } } }
    });
    
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinique non trouvée' });
    return res.json({ success: true, data: clinic });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
export const getEmergencies = async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, message: 'Coordonnées GPS requises' });

    // 1. Hôpitaux partenaires locaux (PostgreSQL)
    const emergencyWhere: any = { isEmergency24_7: true };
    const localItems = await prisma.clinic.findMany({
      where: emergencyWhere
    });

    // 2. Hôpitaux publics avec service d'urgence (OpenStreetMap)
    let osmClinics: any[] = [];
    const overpassQuery = `[out:json][timeout:5];nwr["emergency"="yes"](around:15000, ${lat}, ${lon});out center;`;
    
    try {
      const osmRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
        headers: { 'User-Agent': 'VitaSpot-Medical-Directory/1.0', 'Accept': 'application/json' }
      });
      
      if (osmRes.ok) {
        const data = await osmRes.json();
        osmClinics = data.elements.map((el: any) => ({
          id: `osm-em-${el.id}`,
          name: el.tags?.name || "Service d'Urgences / Hôpital",
          city: "Géolocalisation automatique",
          address: el.tags?.['addr:street'] ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}` : "Coordonnées exactes sur la carte",
          phone: el.tags?.phone || "Contacter les autorités locales",
          specialties: ["Urgences 24/7", el.tags?.amenity === "hospital" ? "Hôpital" : "Centre Médical"],
          latitude: parseFloat(el.lat || el.center?.lat),
          longitude: parseFloat(el.lon || el.center?.lon),
          isEmergency24_7: true
        }));
      }
    } catch (e) {
      console.warn("OSM indisponible pour les urgences.");
    }

    return res.json({ success: true, data: [...localItems, ...osmClinics] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};