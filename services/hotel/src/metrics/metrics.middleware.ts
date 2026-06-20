import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from './metrics';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const route = req.path;
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e9;
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
      httpRequestsTotal.inc({ method: req.method, status_class: statusClass });
      httpRequestDuration.observe({ method: req.method, route }, durationMs);
    });
    next();
  }
}
