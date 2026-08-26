import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Histogram } from 'prom-client';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total') private readonly requestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const start = process.hrtime.bigint();
    // Nest's routing already resolved this by the time the handler runs, so `route.path` is the
    // parameterized pattern (e.g. "/transactions/:id") rather than the raw URL — keeps the label
    // cardinality bounded regardless of how many distinct ids get requested.
    const route = request.route?.path ?? request.url;

    const record = (status: number) => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { method: request.method, route, status: String(status) };
      this.requestsTotal.inc(labels);
      this.requestDuration.observe(labels, durationSeconds);
    };

    return next.handle().pipe(
      tap({
        // On success, the exception filter chain hasn't run yet at this point but the handler
        // has already set the real status (default 200/201) — response.statusCode is accurate.
        next: () => record(response.statusCode),
        // On error, response.statusCode is NOT yet accurate here (Nest's exception filter sets it
        // after this point in the chain) — read the status straight off the exception instead.
        error: (err: unknown) => record(err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }
}
