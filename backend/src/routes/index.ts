/** Route registry — single place that wires every router under /api/v1. */
import { Router } from 'express';
import { healthRouter } from './health.routes';
import { profileRouter } from './profile.routes';
import { accountsRouter } from './accounts.routes';
import { depositsRouter, paymentsWebhookRouter } from './deposits.routes';
import { transactionsRouter } from './transactions.routes';
import { statementsRouter } from './statements.routes';
import { notificationsRouter, supportRouter } from './notifications.routes';
import { clerkWebhookRouter } from './webhooks.routes';
import { adminRouter } from './admin.routes';

export const api = Router();

api.use('/', healthRouter);
api.use('/', profileRouter);
api.use('/', accountsRouter);
api.use('/', depositsRouter);
api.use('/', transactionsRouter);
api.use('/', statementsRouter);
api.use('/', notificationsRouter);
api.use('/', supportRouter);
api.use('/', adminRouter);

// Webhooks are mounted at the app level with raw-body capture (see app.ts):
// they are re-exported for the assembler.
export { paymentsWebhookRouter, clerkWebhookRouter };
