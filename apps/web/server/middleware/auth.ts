import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  accessToken: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    oauthState?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Session active via cookie standard
  if (req.session && req.session.user) {
    return next();
  }

  // 2. Token Bearer via Header Authorization ou query string
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.auth_token === 'string') {
    token = req.query.auth_token.trim();
  }

  if (token) {
    try {
      const sessionRow = (await db.prepare(`
        SELECT * FROM sessions 
        WHERE token = ? AND datetime(expires_at) > datetime('now')
      `).get(token)) as any;

      if (sessionRow) {
        const user: AuthenticatedUser = {
          id: sessionRow.user_id,
          username: sessionRow.username,
          discriminator: sessionRow.discriminator,
          avatar: sessionRow.avatar,
          accessToken: sessionRow.access_token
        };

        if (req.session) {
          req.session.user = user;
        } else {
          (req as any).session = { user };
        }

        return next();
      }
    } catch (err) {
      // Ignorer l'erreur et renvoyer 401
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Non authentifié. Veuillez vous connecter via Discord.'
  });
}

