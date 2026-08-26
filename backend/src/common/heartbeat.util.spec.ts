import { pingHeartbeat } from './heartbeat.util';

describe('pingHeartbeat', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does nothing when no URL is configured', async () => {
    global.fetch = jest.fn();

    await pingHeartbeat(undefined, 'some job');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('pings the given URL when one is configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await pingHeartbeat('https://hc-ping.com/abc-123', 'some job');

    expect(global.fetch).toHaveBeenCalledWith('https://hc-ping.com/abc-123', expect.objectContaining({}));
  });

  it('never throws when the ping itself fails — a monitoring hiccup must not fail the cron job', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    await expect(pingHeartbeat('https://hc-ping.com/abc-123', 'some job')).resolves.toBeUndefined();
  });
});
