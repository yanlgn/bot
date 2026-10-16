import { Request, Response, NextFunction } from 'express';

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié. Veuillez vous connecter via Discord.'
    });
  }
  next();
}
