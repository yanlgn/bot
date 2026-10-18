import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { logger } from '../botClient.js';
import { db } from '../db.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Trop de tentatives d\'authentification. Réessayez plus tard.' }
});

authRouter.use(authLimiter);

/**
 * Résout dynamiquement l'origine HTTP(S) + Host de la requête courante
 * Compatible avec tous les reverse-proxies (Render, Cloudflare, Nginx, Caddy...)
 */
function getHostOrigin(req: Request): string {
  // Protocole
  let proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (Array.isArray(proto)) proto = proto[0];
  if (typeof proto === 'string' && proto.includes(',')) proto = proto.split(',')[0].trim();

  // Hôte (nom de domaine ou IP + port)
  let host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3001';
  if (Array.isArray(host)) host = host[0];
  if (typeof host === 'string' && host.includes(',')) host = host.split(',')[0].trim();

  return `${proto}://${host}`;
}

function getLoginRedirectUri(req: Request): string {
  const origin = getHostOrigin(req);

  // 1. Si le client demande un chemin explicite via ?redirect_path=...
  if (typeof req.query.redirect_path === 'string') {
    const customPath = req.query.redirect_path.startsWith('/') ? req.query.redirect_path : `/${req.query.redirect_path}`;
    return `${origin}${customPath}`;
  }

  // 2. Si DISCORD_REDIRECT_PATH est défini dans les variables d'environnement
  if (process.env.DISCORD_REDIRECT_PATH) {
    const customPath = process.env.DISCORD_REDIRECT_PATH.startsWith('/') ? process.env.DISCORD_REDIRECT_PATH : `/${process.env.DISCORD_REDIRECT_PATH}`;
    return `${origin}${customPath}`;
  }

  // 3. Si DISCORD_REDIRECT_URI est renseigné avec un ancien ou nouveau domaine, on extrait son pathname
  if (process.env.DISCORD_REDIRECT_URI) {
    try {
      const parsed = new URL(process.env.DISCORD_REDIRECT_URI);
      return `${origin}${parsed.pathname}`;
    } catch {}
  }

  // 4. Par défaut : route de callback standard
  return `${origin}/admin/auth/discord/callback`;
}

function getCallbackRedirectUri(req: Request): string {
  const origin = getHostOrigin(req);
  const pathWithoutQuery = req.originalUrl.split('?')[0];
  return `${origin}${pathWithoutQuery}`;
}

function getFrontendUrl(req: Request): string {
  return getHostOrigin(req);
}

/**
 * Handler de login OAuth2
 */
export const handleOAuthLogin = (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID || '1350228159005724772';
  const redirectUriRaw = getLoginRedirectUri(req);
  const redirectUri = encodeURIComponent(redirectUriRaw);
  const state = randomBytes(16).toString('hex');

  req.session.oauthState = state;

  logger.info({ redirectUri: redirectUriRaw, host: req.get('host') }, '🔗 Démarrage du flux OAuth2 avec redirect_uri dynamique');

  const scope = encodeURIComponent('identify guilds');
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, 'Erreur lors de la sauvegarde de session login');
    }
    res.redirect(authUrl);
  });
};

/**
 * Handler universel du callback OAuth2
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = getFrontendUrl(req);
  const redirectUri = getCallbackRedirectUri(req);

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

    // 3. Génération d'un token d'authentification persistant
    const authToken = randomBytes(32).toString('hex');

    try {
      await db.prepare(`
        INSERT INTO sessions (token, user_id, username, discriminator, avatar, access_token, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+14 days'))
      `).run(
        authToken,
        userData.id,
        userData.username,
        userData.discriminator,
        userData.avatar,
        tokenData.access_token
      );
    } catch (dbErr) {
      logger.error({ dbErr }, 'Erreur lors de l\'enregistrement du token de session en base');
    }

    // 4. Sauvegarde également dans la session express (si les cookies sont acceptés par le navigateur)
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      accessToken: tokenData.access_token
    };

    req.session.save(() => {
      logger.info({ user: userData.username }, 'Utilisateur authentifié avec succès via Discord OAuth2');
      res.redirect(`/guilds?auth_token=${authToken}`);
    });
  } catch (error) {
    logger.error({ error }, 'Erreur lors du callback OAuth2');
    res.redirect(`${frontendUrl}/login?error=server_error`);
  }
};

authRouter.get('/login', handleOAuthLogin);
authRouter.get('/callback', handleOAuthCallback);
authRouter.get('/discord/callback', handleOAuthCallback);

/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur et détruit la session
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    try {
      await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } catch {}
  }

  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('sciclub_session');
      res.clearCookie('cortex_session');
      res.json({ success: true, message: 'Déconnexion réussie.' });
    });
  } else {
    res.clearCookie('sciclub_session');
    res.clearCookie('cortex_session');
    res.json({ success: true, message: 'Déconnexion réussie.' });
  }
});
