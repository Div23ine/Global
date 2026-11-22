/** Customer profile endpoints (permitted-field patch and preferences). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getServiceClient, getUserClient } from '../services/supabase.service';
import { auditAllowed } from '../services/audit.service';
import { notFound, ok } from '../utils/httpError';

export const profileRouter = Router();

profileRouter.use('/profile', requireAuth);

profileRouter.get('/profile', async (req, res, next) => {
  try {
    // Read through the user-scoped client: RLS enforces row ownership.
    const db = getUserClient(req.auth!.supabaseJwt);
    const { data, error } = await db.from('profiles').select('*').eq('id', req.auth!.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Profile not found — please contact support.');
    ok(res, data, 'Profile');
  } catch (err) { next(err); }
});

const patchSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164').optional().nullable(),
  prefs: z
    .object({
      emailNotifs: z.boolean().optional(),
      pushNotifs: z.boolean().optional(),
      weeklySummary: z.boolean().optional(),
    })
    .optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'No permitted fields provided' });

profileRouter.patch('/profile', validate(patchSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const patch: Record<string, unknown> = {};
    if (req.body.firstName !== undefined) {
      patch.first_name = req.body.firstName;
      patch.full_name = `${req.body.firstName} ${req.body.lastName ?? ''}`.trim();
    }
    if (req.body.lastName !== undefined) {
      patch.last_name = req.body.lastName;
    }
    if (req.body.phone !== undefined) patch.phone = req.body.phone;
    if (req.body.prefs !== undefined) {
      const { data: current } = await db.from('profiles').select('prefs').eq('id', req.auth!.userId).single();
      patch.prefs = { ...(current?.prefs as object ?? {}), ...req.body.prefs };
    }
    const { data, error } = await db.from('profiles').update(patch).eq('id', req.auth!.userId).select('*').single();
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'profile.update', { type: 'profile', id: req.auth!.userId },
      { fields: Object.keys(req.body) }, { ip: req.ip, userAgent: req.get('user-agent') });
    ok(res, data, 'Profile updated');
  } catch (err) { next(err); }
});
