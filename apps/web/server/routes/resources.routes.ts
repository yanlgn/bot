import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireGuildAdmin } from '../middleware/permissions.js';
import { validateBody } from '../middleware/validate.js';
import { CreateResourceSchema } from '@sciclub/shared';
import { db } from '../db.js';
import { randomUUID } from 'crypto';

export const resourcesRouter = Router({ mergeParams: true });

resourcesRouter.get('/', requireAuth, requireGuildAdmin, (req: Request, res: Response) => {
  const resources = db.prepare(`
    SELECT id, guild_id as guildId, title, description, url, category, tags, author_id as authorId, created_at as createdAt
    FROM resources
    WHERE guild_id = ?
    ORDER BY created_at DESC
  `).all(req.params.guildId) as any[];

  const list = resources.map(r => ({
    ...r,
    tags: JSON.parse(r.tags || '[]')
  }));

  res.json({ success: true, data: list });
});

resourcesRouter.post('/', requireAuth, requireGuildAdmin, validateBody(CreateResourceSchema), (req: Request, res: Response) => {
  const resourceId = randomUUID();
  const user = req.session.user!;

  db.prepare(`
    INSERT INTO resources (id, guild_id, title, description, url, category, tags, author_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    resourceId,
    req.params.guildId,
    req.body.title,
    req.body.description,
    req.body.url,
    req.body.category,
    JSON.stringify(req.body.tags),
    user.id
  );

  res.status(201).json({ success: true, data: { id: resourceId, title: req.body.title } });
});
