import { Request, Response, NextFunction } from 'express';
import auth from 'basic-auth';

// Middleware to enforce Tailscale internal network access
export const requireTailscaleInternal = (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.ip || req.connection.remoteAddress || '';
    
    // Normalize IPv4-mapped IPv6 address (e.g. ::ffff:100.83.142.33 -> 100.83.142.33)
    let ip = rawIp;
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    
    const allowedPrefix = process.env.ADMIN_ALLOWED_IP_PREFIX || '100.';
    
    if (ip.startsWith(allowedPrefix) || ip === '127.0.0.1' || ip === '::1') {
        return next();
    }
    
    console.warn(`[Admin Security] Blocked external access attempt. rawIP: ${rawIp}, normalizedIP: ${ip}`);
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
