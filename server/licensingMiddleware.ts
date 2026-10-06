import { Request, Response, NextFunction } from 'express';
import { LicensingService } from './licensingService';
import { TenantContext } from './tenantContext';

export function requireActiveLicense(req: Request, res: Response, next: NextFunction) {
  const tc = (req as any).tenantContext as TenantContext | undefined;
  if (!tc) {
    return res.status(404).json({ success: false, error: 'TENANT_NOT_RESOLVED' });
  }

  // Check license
  LicensingService.getEffectiveLicense(tc.tenantId).then(license => {
    if (!license || ['EXPIRED', 'REVOKED', 'SUSPENDED', 'CANCELLED'].includes(license.status)) {
        return res.status(403).json({ success: false, error: 'LICENSE_REQUIRED', message: 'مجوز معتبر یافت نشد.' });
    }
    next();
  }).catch(err => {
    res.status(500).json({ success: false, message: 'خطا در بررسی مجوز.' });
  });
}

export function requireEntitlement(module: string, action: string = 'VIEW') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tc = (req as any).tenantContext as TenantContext | undefined;
    if (!tc) {
      return res.status(404).json({ success: false, error: 'TENANT_NOT_RESOLVED' });
    }

    try {
        await LicensingService.requireEntitlement(tc.tenantId, module, action);
        next();
    } catch (err: any) {
        res.status(403).json({ success: false, error: 'ENTITLEMENT_REQUIRED', message: err.message });
    }
  };
}
