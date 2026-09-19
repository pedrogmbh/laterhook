import { listRoutes } from "@/lib/repo";
import type { Route } from "@/lib/types";

export * from "@/lib/route-match";

/**
 * Enabled routes, freshly read on every capture. Deliberately uncached: a
 * route must apply to the very next request after it is saved, and serverless
 * instances (or dev module graphs) don't share memory anyway. The table is tiny.
 */
export function getEnabledRoutes(): Promise<Route[]> {
  return listRoutes({ enabledOnly: true });
}

/** Kept for call-site symmetry; nothing to invalidate without a cache. */
export function invalidateRouteCache(): void {}
