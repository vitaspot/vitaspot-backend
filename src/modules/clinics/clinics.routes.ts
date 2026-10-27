import { Router } from 'express';
import { getClinics, getEmergencies, getClinicById, getClinicBySlug } from './clinics.controller';

const clinicsRouter = Router();

clinicsRouter.get('/', getClinics);
clinicsRouter.get('/emergencies', getEmergencies);
clinicsRouter.get('/:slug', getClinicBySlug);

export default clinicsRouter;