import { DbPoolMetricsService } from './db-pool-metrics.service';

describe('DbPoolMetricsService', () => {
  let totalGauge: { set: jest.Mock };
  let idleGauge: { set: jest.Mock };
  let waitingGauge: { set: jest.Mock };
  let prisma: { pool: { totalCount: number; idleCount: number; waitingCount: number } };

  beforeEach(() => {
    jest.useFakeTimers();
    totalGauge = { set: jest.fn() };
    idleGauge = { set: jest.fn() };
    waitingGauge = { set: jest.fn() };
    prisma = { pool: { totalCount: 5, idleCount: 3, waitingCount: 1 } };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('samples the pg pool counters into their gauges on an interval', () => {
    const service = new DbPoolMetricsService(prisma as never, totalGauge as never, idleGauge as never, waitingGauge as never);

    service.onModuleInit();
    expect(totalGauge.set).not.toHaveBeenCalled(); // nothing sampled before the first tick

    jest.advanceTimersByTime(5000);

    expect(totalGauge.set).toHaveBeenCalledWith(5);
    expect(idleGauge.set).toHaveBeenCalledWith(3);
    expect(waitingGauge.set).toHaveBeenCalledWith(1);
  });

  it('re-samples on every subsequent tick, reflecting the pool state at that moment', () => {
    const service = new DbPoolMetricsService(prisma as never, totalGauge as never, idleGauge as never, waitingGauge as never);
    service.onModuleInit();

    jest.advanceTimersByTime(5000);
    prisma.pool.totalCount = 8;
    jest.advanceTimersByTime(5000);

    expect(totalGauge.set).toHaveBeenLastCalledWith(8);
  });
});
