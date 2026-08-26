import { Logger } from '@nestjs/common';

const logger = new Logger('Heartbeat');
const PING_TIMEOUT_MS = 5000;

// Pings a "dead man's switch" monitoring URL (Uptime Kuma push endpoint, healthchecks.io, etc.)
// after a cron job finishes successfully — lets external monitoring alert when a job silently
// stops running, not just when it throws. No-ops when no URL is configured (nothing wired up), and
// a failed ping is only logged — it must never fail the cron job that just ran successfully.
export async function pingHeartbeat(url: string | undefined, jobName: string): Promise<void> {
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(url, { signal: controller.signal });
  } catch (err) {
    logger.warn(`Heartbeat ping for "${jobName}" failed: ${err}`);
  } finally {
    clearTimeout(timeout);
  }
}
