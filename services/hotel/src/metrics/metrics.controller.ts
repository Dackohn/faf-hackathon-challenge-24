import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { registry } from './metrics';

@Controller('metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  }
}
