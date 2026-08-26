import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Gauge } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

const SAMPLE_INTERVAL_MS = 5000;

@Injectable()
export class DbPoolMetricsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectMetric('db_pool_total_connections') private readonly totalGauge: Gauge<string>,
    @InjectMetric('db_pool_idle_connections') private readonly idleGauge: Gauge<string>,
    @InjectMetric('db_pool_waiting_requests') private readonly waitingGauge: Gauge<string>,
  ) {}

  onModuleInit(): void {
    // node-postgres's Pool has no "changed" event to subscribe to — polling its own in-memory
    // counters (no query involved) is the standard way to expose this to Prometheus.
    // .unref() so this timer never keeps the process alive on its own (matters for tests and
    // graceful shutdown).
    setInterval(() => {
      const pool = this.prisma.pool;
      this.totalGauge.set(pool.totalCount);
      this.idleGauge.set(pool.idleCount);
      this.waitingGauge.set(pool.waitingCount);
    }, SAMPLE_INTERVAL_MS).unref();
  }
}
