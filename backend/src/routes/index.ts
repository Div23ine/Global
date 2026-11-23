/** Route registry — single place that wires every router under /api/v1. */
import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { profileRouter } from './profile.routes';
import { accountsRouter } from './accounts.routes';
import { depositsRouter, paymentsWebhookRouter } from './deposits.routes';
import { transactionsRouter } from './transactions.routes';
import { statementsRouter } from './statements.routes';
import { notificationsRouter, supportRouter } from './notifications.routes';
import { adminRouter } from './admin.routes';

export const api = Router();
api.use('/', healthRouter);
api.use('/auth', authRouter);
api.use('/', profileRouter);
api.use('/', accountsRouter);
api.use('/', depositsRouter);
api.use('/', transactionsRouter);
api.use('/', statementsRouter);
api.use('/', notificationsRouter);
api.use('/', supportRouter);
api.use('/', adminRouter);
export { paymentsWebhookRouter };
