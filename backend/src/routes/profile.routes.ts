/** Customer profile endpoints (permitted-field patch and preferences). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, subjectUserId, actorUserId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getServiceClient, getUserClient } from '../services/supabase.service';
import { auditAllowed } from '../services/audit.service';
import { forbidden, notFound, ok } from '../utils/httpError';
import { computeFullName } from '../utils/name';

export const profileRouter = Router();

profileRouter.use('/profile', requireAuth);

profileRouter.get('/profile', async (req, res, next) => {
  try {
    const subject = subjectUserId(req);
    // Takeover uses service role with explicit subject filter; normal path uses RLS.
    const db = req.takeover ? getServiceClient() : getUserClient(req.auth!.supabaseJwt);
    const { data, error } = await db.from('profiles').select('*').eq('id', subject).maybeSingle();
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
    // Takeover permits only basic contact/name corrections. Preferences and
    // every other profile setting remain customer-controlled.
    if (req.takeover && req.body.prefs !== undefined) {
      throw forbidden('Only basic profile details may be updated during account takeover.');
    }
    const db = getServiceClient();
    const patch: Record<string, unknown> = {};
    // full_name is recomputed from the STORED parts plus the patched parts, so
    // a partial patch never erases or stales the unpatched half (audit F-7).
    const subject = subjectUserId(req);
    if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
      const { data: cur } = await db.from('profiles')
        .select('first_name, last_name').eq('id', subject).maybeSingle();
      patch.full_name = computeFullName(cur ?? null, {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
      });
      if (req.body.firstName !== undefined) patch.first_name = req.body.firstName;
      if (req.body.lastName !== undefined) patch.last_name = req.body.lastName;
    }
    if (req.body.phone !== undefined) patch.phone = req.body.phone;
    if (req.body.prefs !== undefined) {
      const { data: current } = await db.from('profiles').select('prefs').eq('id', subjectUserId(req)).single();
      patch.prefs = { ...(current?.prefs as object ?? {}), ...req.body.prefs };
    }
    const { data, error } = await db.from('profiles').update(patch).eq('id', subjectUserId(req)).select('*').single();
    if (error) throw new Error(error.message);
    await auditAllowed(actorUserId(req), 'profile.update', { type: 'profile', id: subjectUserId(req) },
      { fields: Object.keys(req.body) }, { ip: req.ip, userAgent: req.get('user-agent') });
    ok(res, data, 'Profile updated');
  } catch (err) { next(err); }
});
