import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In-memory token store for authenticated admin sessions
const activeAdminTokens = new Map<string, { adminId: string; username: string; expiresAt: number }>();

export function generateAdminToken(adminId: string, username: string): string {
  const token = `cca_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  activeAdminTokens.set(token, { adminId, username, expiresAt });
  return token;
}

export function revokeAdminToken(token: string): void {
  activeAdminTokens.delete(token);
}

export interface AuthenticatedRequest extends Request {
  adminUser?: {
    adminId: string;
    username: string;
  };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authentication token required'
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const session = activeAdminTokens.get(token);

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired admin session token. Please log in again.'
    });
    return;
  }

  if (Date.now() > session.expiresAt) {
    activeAdminTokens.delete(token);
    res.status(401).json({
      success: false,
      error: 'Admin session expired. Please log in again.'
    });
    return;
  }

  req.adminUser = {
    adminId: session.adminId,
    username: session.username
  };

  next();
}
