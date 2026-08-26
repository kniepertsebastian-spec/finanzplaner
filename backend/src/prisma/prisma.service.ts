import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Constructed as our own pg.Pool (rather than handing PrismaPg a bare config object) so it can be
// exposed below for DB-pool metrics (backend/src/metrics/db-pool-metrics.service.ts) — PrismaPg
// doesn't expose the pool it would otherwise create internally.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// disposeExternalPool: true — without it, Prisma assumes an externally-provided pool is managed
// elsewhere and leaves it open on $disconnect(), which would leak connections on every shutdown
// now that this pool isn't the one Prisma would have created (and closed) internally by default.
const adapter = new PrismaPg(pool, { disposeExternalPool: true });

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  readonly pool = pool;

  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
