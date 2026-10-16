import { Request, Response, NextFunction } from 'express';
import { logger } from '../botClient.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, 'Erreur serveur non interceptée');

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Une erreur interne est survenue sur le serveur SciClub.',
    code: err.code || 'INTERNAL_ERROR'
  });
}
