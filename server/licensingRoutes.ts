import { Router, Request, Response } from 'express';
import { query } from './pg';
import { LicensingService, LicenseStateService } from './licensingService';
import { User } from '../src/types';

export const licensingRouter = Router();

async function requirePlatformAdmin(req: Request, res: Response, next: any): Promise<void> {
  const authUser: User | undefined = (req as any).authUser;
  if (!authUser) {
    res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    return;
  }

  const rows = await query<{ id: string }>(
    'SELECT id FROM "platformAdmin" WHERE "userId" = $1 LIMIT 1',
    [authUser.id],
  );

  if (!rows[0]) {
    res.status(403).json({
      success: false,
      message: 'فقط مدیران پلتفرم اجازه این عملیات را دارند.',
    });
    return;
  }

  next();
}

licensingRouter.use(requirePlatformAdmin);

// --- Plans ---
licensingRouter.get('/plans', async (req: Request, res: Response) => {
    try {
        const plans = await query('SELECT * FROM plan ORDER BY "sortOrder"');
        res.json({ success: true, plans });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/plans', async (req: Request, res: Response) => {
    try {
        const { key, name, description, sortOrder } = req.body;
        if (!key || !name) {
            return res.status(400).json({ success: false, message: 'key و name الزامی است.' });
        }
        const result = await query(
            'INSERT INTO plan (id, key, name, description, "sortOrder") VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *',
            [key.toUpperCase(), name, description, sortOrder || 0]
        );
        res.status(201).json({ success: true, plan: result[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.get('/plans/:id', async (req: Request, res: Response) => {
    try {
        const plans = await query('SELECT * FROM plan WHERE id = $1', [req.params.id]);
        if (!plans[0]) return res.status(404).json({ success: false, message: 'طرح یافت نشد.' });
        res.json({ success: true, plan: plans[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.patch('/plans/:id', async (req: Request, res: Response) => {
    try {
        const { name, description, isActive, sortOrder } = req.body;
        const result = await query(
            'UPDATE plan SET name = COALESCE($1, name), description = COALESCE($2, description), "isActive" = COALESCE(CAST($3 AS BOOLEAN), "isActive"), "sortOrder" = COALESCE($4, "sortOrder"), "updatedAt" = NOW() WHERE id = $5 RETURNING *',
            [name, description, isActive, sortOrder, req.params.id]
        );
        if (!result[0]) return res.status(404).json({ success: false, message: 'طرح یافت نشد.' });
        res.json({ success: true, plan: result[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Tenant Licenses ---
licensingRouter.get('/tenants/:tenantId/license', async (req: Request, res: Response) => {
    try {
        const license = await LicensingService.getTenantLicense(req.params.tenantId);
        res.json({ success: true, license });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/tenants/:tenantId/license', async (req: Request, res: Response) => {
    try {
        const { planId, status, startsAt, expiresAt } = req.body;
        const tenantId = req.params.tenantId;

        // Check if tenant exists
        const tenant = await query('SELECT id FROM tenant WHERE id = $1', [tenantId]);
        if (!tenant[0]) return res.status(404).json({ success: false, message: 'پلتفرم یافت نشد.' });

        // Upsert license
        const result = await query(
            `INSERT INTO license (id, "tenantId", "planId", status, "startsAt", "expiresAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, COALESCE($3, 'ACTIVE'), COALESCE($4, NOW()), $5, NOW())
             ON CONFLICT ("tenantId") DO UPDATE
             SET "planId" = EXCLUDED."planId", status = EXCLUDED.status, "startsAt" = EXCLUDED."startsAt", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW()
             RETURNING *`,
            [tenantId, planId, status, startsAt, expiresAt || null]
        );

        res.status(201).json({ success: true, license: result[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.patch('/tenants/:tenantId/license', async (req: Request, res: Response) => {
    try {
        const { planId, expiresAt } = req.body;
        const result = await query(
            `UPDATE license SET "planId" = COALESCE($1, "planId"), "expiresAt" = COALESCE($2, "expiresAt"), "updatedAt" = NOW()
             WHERE "tenantId" = $3 RETURNING *`,
            [planId, expiresAt, req.params.tenantId]
        );
        if (!result[0]) return res.status(404).json({ success: false, message: 'مجوز یافت نشد.' });
        res.json({ success: true, license: result[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/tenants/:tenantId/license/activate', async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).authUser as User;
        const { reason } = req.body;
        const license = await LicenseStateService.transition(req.params.tenantId, 'ACTIVE', reason, authUser?.id);
        res.json({ success: true, license });
    } catch (err: any) {
        res.status(400).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/tenants/:tenantId/license/suspend', async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).authUser as User;
        const { reason } = req.body;
        const license = await LicenseStateService.transition(req.params.tenantId, 'SUSPENDED', reason, authUser?.id);
        res.json({ success: true, license });
    } catch (err: any) {
        res.status(400).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/tenants/:tenantId/license/revoke', async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).authUser as User;
        const { reason } = req.body;
        const license = await LicenseStateService.transition(req.params.tenantId, 'REVOKED', reason, authUser?.id);
        res.json({ success: true, license });
    } catch (err: any) {
        res.status(400).json({ success: false, message: err.message });
    }
});

licensingRouter.post('/tenants/:tenantId/license/renew', async (req: Request, res: Response) => {
    try {
        // Renewal usually transitions EXPIRED or GRACE to ACTIVE, or extends expiresAt
        const { expiresAt } = req.body;
        const tenantId = req.params.tenantId;

        const result = await query(
            `UPDATE license SET status = 'ACTIVE', "expiresAt" = COALESCE($1, "expiresAt"), "updatedAt" = NOW()
             WHERE "tenantId" = $2 RETURNING *`,
            [expiresAt || null, tenantId]
        );
        if (!result[0]) return res.status(404).json({ success: false, message: 'مجوز یافت نشد.' });
        res.json({ success: true, license: result[0] });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});
