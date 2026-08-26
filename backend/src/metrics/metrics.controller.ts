import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';

// Prometheus scrapers don't carry the app's auth cookie, so this route needs to bypass the global
// JwtAuthGuard the same way login/register do — via the existing @Public() mechanism, rather than
// special-casing the path inside the guard itself.
@Public()
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
