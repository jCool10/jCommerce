/**
 * Convert a redis://[:pass@]host:port/db URL to the ConnectionOptions shape
 * BullMQ expects. We hand BullMQ plain options (not an ioredis instance) so
 * BullMQ creates its own client — this avoids depending on the workspace's
 * ioredis version matching the one bullmq ships with.
 */
export interface ParsedRedisOptions {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
}

export function parseRedisUrl(url: string): ParsedRedisOptions {
  const u = new URL(url);
  const opts: ParsedRedisOptions = {
    host: u.hostname,
    port: Number(u.port || 6379),
  };
  if (u.password) opts.password = decodeURIComponent(u.password);
  if (u.username) opts.username = decodeURIComponent(u.username);
  const dbPath = u.pathname.replace(/^\//, '');
  if (dbPath.length > 0) {
    const db = Number(dbPath);
    if (!Number.isNaN(db)) opts.db = db;
  }
  return opts;
}
