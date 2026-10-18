import { Request, Response, NextFunction } from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { discordClient } from '../botClient.js';
import fs from 'fs';
import path from 'path';

export async function requireGuildAdmin(req: Request, res: Response, next: NextFunction) {
  const guildId = req.params.guildId;
  const user = req.session?.user;

  if (!guildId) {
    return res.status(400).json({ success: false, error: 'Paramètre guildId manquant.' });
  }

  if (!user) {
    return res.status(401).json({ success: false, error: 'Non authentifié.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Le bot n\'est pas présent sur ce serveur Discord.'
      });
    }

    // Le propriétaire a tous les droits
    if (guild.ownerId === user.id) {
      return next();
    }

    // Vérifie si le membre existe sur le serveur
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas membre de ce serveur Discord.'
      });
    }

    // Droits Discord natifs
    const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasManageGuild = member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (hasAdmin || hasManageGuild) {
      return next();
    }

    // Vérifie si l'utilisateur possède le rôle 'admin' configuré dans le JSON du serveur
    try {
      const configPath = path.resolve(process.cwd(), process.env.CONFIG_PATH || './config/guilds', `${guildId}.json`);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const adminRoleName = config?.roles?.admin?.name?.toLowerCase();
        if (adminRoleName && member.roles.cache.some(r => r.name.toLowerCase() === adminRoleName)) {
          return next();
        }
      }
    } catch {
      // Ignorer l'erreur de fichier
    }

    return res.status(403).json({
      success: false,
      error: 'Accès refusé. Vous devez posséder la permission "Gérer le serveur" ou un rôle administrateur du club.'
    });
  } catch (err: any) {
    return res.status(403).json({
      success: false,
      error: `Impossible de vérifier vos permissions : ${err.message}`
    });
  }
}
