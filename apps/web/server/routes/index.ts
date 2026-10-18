import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';
import { guildsRouter } from './guilds.routes.js';
import { rolesRouter } from './roles.routes.js';
import { channelsRouter } from './channels.routes.js';
import { permissionsRouter } from './permissions.routes.js';
import { membersRouter } from './members.routes.js';
import { projectsRouter } from './projects.routes.js';
import { eventsRouter } from './events.routes.js';
import { resourcesRouter } from './resources.routes.js';
import { moderationRouter } from './moderation.routes.js';
import { statsRouter } from './stats.routes.js';
import { configRouter } from './config.routes.js';
import { departmentsRouter } from './departments.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/guilds', guildsRouter);

// Routes rattachées à une guilde spécifique
apiRouter.use('/guilds/:guildId/departments', departmentsRouter);
apiRouter.use('/guilds/:guildId/roles', rolesRouter);
apiRouter.use('/guilds/:guildId/channels', channelsRouter);
apiRouter.use('/guilds/:guildId', permissionsRouter);
apiRouter.use('/guilds/:guildId/members', membersRouter);
apiRouter.use('/guilds/:guildId/projects', projectsRouter);
apiRouter.use('/guilds/:guildId/events', eventsRouter);
apiRouter.use('/guilds/:guildId/resources', resourcesRouter);
apiRouter.use('/guilds/:guildId/moderation', moderationRouter);
apiRouter.use('/guilds/:guildId/stats', statsRouter);
apiRouter.use('/guilds/:guildId/config', configRouter);
apiRouter.use('/guilds/:guildId', configRouter); // Pour /audit-logs
