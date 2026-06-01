import { Request, Response, NextFunction } from 'express';
import auth from 'basic-auth';

// Middleware to enforce Tailscale internal network access
export const requireTailscaleInternal = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    
    // In Express, when running behind a proxy (like Tailscale funnel locally), req.ip might need trust proxy.
    // For a local Tailscale node, the IP might appear as 127.0.0.1 or ::1 locally.
    // However, the strict requirement is to block public funnel access if possible, or strictly rely on auth.
    // Since Tailscale IPs are usually 100.x.x.x, we check for it.
    // For local dev safety, we also allow localhost.
    const allowedPrefix = process.env.ADMIN_ALLOWED_IP_PREFIX || '100.';
    
    if (ip.startsWith(allowedPrefix) || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        return next();
    }
    
    console.warn(`[Admin Security] Blocked external access attempt from IP: ${ip}`);
    res.status(403).send('Forbidden: Internal access only');
};

// Middleware for Basic Auth
export const requireAdminBasicAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = auth(req);
    const adminUser = process.env.ADMIN_DASH_USER;
    const adminPass = process.env.ADMIN_DASH_PASS;

    if (!adminUser || !adminPass) {
        console.error('[Admin Security] Basic Auth credentials not configured in .env!');
        res.status(500).send('Server configuration error');
        return;
    }

    if (!user || user.name !== adminUser || user.pass !== adminPass) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        res.status(401).send('Unauthorized');
        return;
    }

    next();
};
