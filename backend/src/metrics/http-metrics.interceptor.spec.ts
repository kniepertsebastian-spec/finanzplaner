import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let requestsTotal: { inc: jest.Mock };
  let requestDuration: { observe: jest.Mock };

  const buildContext = (overrides: Partial<{ method: string; route: { path: string }; url: string }> = {}) => {
    const request = { method: 'GET', url: '/transactions/abc-123', ...overrides };
    const response = { statusCode: 200 };
    return {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;
  };

  const buildHandler = (result: unknown, isError = false): CallHandler => ({
    handle: () => (isError ? throwError(() => result) : of(result)),
  });

  beforeEach(() => {
    requestsTotal = { inc: jest.fn() };
    requestDuration = { observe: jest.fn() };
    interceptor = new HttpMetricsInterceptor(requestsTotal as never, requestDuration as never);
  });

  it('passes non-HTTP contexts (e.g. cron/RPC) straight through without recording anything', () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    const handler = buildHandler('result');

    interceptor.intercept(context, handler).subscribe();

    expect(requestsTotal.inc).not.toHaveBeenCalled();
  });

  it('records the parameterized route, method, and status on success', (done) => {
    const context = buildContext({ route: { path: '/transactions/:id' } });
    const handler = buildHandler({ ok: true });

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(requestsTotal.inc).toHaveBeenCalledWith({ method: 'GET', route: '/transactions/:id', status: '200' });
        expect(requestDuration.observe).toHaveBeenCalledWith(
          { method: 'GET', route: '/transactions/:id', status: '200' },
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('falls back to the raw URL when no route pattern is available', (done) => {
    const context = buildContext({ url: '/unmatched' });
    const handler = buildHandler({ ok: true });

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(requestsTotal.inc).toHaveBeenCalledWith(expect.objectContaining({ route: '/unmatched' }));
        done();
      },
    });
  });

  it('records the exception status on error, not the (still-default) response.statusCode', (done) => {
    const context = buildContext({ route: { path: '/budgets' } });
    const handler = buildHandler(new HttpException('nope', 403), true);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(requestsTotal.inc).toHaveBeenCalledWith({ method: 'GET', route: '/budgets', status: '403' });
        done();
      },
    });
  });

  it('records status 500 for a non-HttpException error', (done) => {
    const context = buildContext({ route: { path: '/budgets' } });
    const handler = buildHandler(new Error('boom'), true);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(requestsTotal.inc).toHaveBeenCalledWith(expect.objectContaining({ status: '500' }));
        done();
      },
    });
  });
});
