import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { logger } from '../botClient.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Trop de tentatives d\'authentification. Réessayez plus tard.' }
});

authRouter.use(authLimiter);

function getRedirectUri(req: Request): string {
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return host ? `${proto}://${host}/api/auth/callback` : 'http://localhost:3001/api/auth/callback';
}

function getFrontendUrl(req: Request): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return host ? `${proto}://${host}` : 'http://localhost:5173';
}

/**
 * GET /api/auth/login
 * Redirige vers la page d'autorisation Discord OAuth2 avec state CSRF
 */
authRouter.get('/login', (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID || '1350228159005724772';
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const state = randomBytes(16).toString('hex');

  req.session.oauthState = state;

  const scope = encodeURIComponent('identify guilds');
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, 'Erreur lors de la sauvegarde de session login');
    }
    res.redirect(authUrl);
  });
});

/**
 * GET /api/auth/callback
 * Échange le code contre un token, récupère le profil utilisateur et initie la session
 */
authRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = getFrontendUrl(req);
  const redirectUri = getRedirectUri(req);

  if (!code) {
    logger.warn('Aucun code OAuth2 fourni dans le callback');
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }

  // Vérification de sécurité du state si présent en session
  if (req.session?.oauthState && state && req.session.oauthState !== state) {
    logger.warn({ expected: req.session.oauthState, received: state }, 'Incohérence du state OAuth2');
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }

  if (req.session) {
    delete req.session.oauthState;
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || '1350228159005724772',
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: redirectUri
    });

    // 1. Échange du code d'autorisation
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error({ errText, redirectUri }, 'Erreur échange token Discord');
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string; token_type: string };

    // 2. Récupération des informations de l'utilisateur
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      return res.redirect(`${frontendUrl}/login?error=user_fetch_failed`);
    }

    const userData = (await userRes.json()) as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
    };

    // 3. Sauvegarde dans la session serveur uniquement avec confirmation explicite
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      accessToken: tokenData.access_token
    };

    req.session.save((err) => {
      if (err) {
        logger.error({ err }, 'Erreur lors de la persistance de session utilisateur');
        return res.redirect(`${frontendUrl}/login?error=session_save_failed`);
      }

      logger.info({ user: userData.username }, 'Utilisateur authentifié avec succès via Discord OAuth2');
      res.redirect(`${frontendUrl}/guilds`);
    });
  } catch (error) {
    logger.error({ error }, 'Erreur lors du callback OAuth2');
    res.redirect(`${frontendUrl}/login?error=server_error`);
  }
});

/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur et détruit la session
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Impossible de détruire la session' });
    }
    res.clearCookie('sciclub_session');
    res.clearCookie('cortex_session');
    res.json({ success: true, message: 'Déconnexion réussie.' });
  });
});
