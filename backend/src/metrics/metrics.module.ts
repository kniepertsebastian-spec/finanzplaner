import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrometheusModule, makeCounterProvider, makeGaugeProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { DbPoolMetricsService } from './db-pool-metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [PrometheusModule.register({ path: '/metrics', controller: MetricsController })],
  providers: [
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
    }),
    makeGaugeProvider({ name: 'db_pool_total_connections', help: 'Total connections in the Postgres pool' }),
    makeGaugeProvider({ name: 'db_pool_idle_connections', help: 'Idle connections in the Postgres pool' }),
    makeGaugeProvider({
      name: 'db_pool_waiting_requests',
      help: 'Requests currently waiting for a free Postgres pool connection',
    }),
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    DbPoolMetricsService,
  ],
})
export class MetricsModule {}
