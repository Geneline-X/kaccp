/* Tiny in-process TTL cache.
 *
 * Exists to keep expensive aggregates off the database. Each API route runs as
 * its own serverless process with a pool of one connection, so a query avoided
 * is a connection freed — which matters more here than the usual latency win.
 *
 * Deliberately per-process and unbounded-TTL-free: a warm instance serves the
 * cached value, a cold one recomputes. That is fine for numbers that only need
 * to be roughly current (leaderboards, queue depths) and wrong for anything a
 * user expects to see change immediately after their own action.
 */

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

/** In-flight promises, so a burst of requests triggers one query, not N. */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  produce: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  // Collapse concurrent misses onto a single database round trip.
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = produce()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Drop a key (or everything) — used after a write that must be reflected now. */
export function invalidate(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
