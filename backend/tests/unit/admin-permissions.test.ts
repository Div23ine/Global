/**
 * Route-permission contract tests.
 *
 * Promise under test: money-moving administrator operations (deposit
 * crediting/rejection, receiving-bank configuration, refund approval) are
 * gated by the MANAGE-level permissions of the seeded role matrix, so a
 * read-only role (compliance, finance_readonly) can never move money.
 *
 * Realistic defect that turns this red: a new or edited admin route wired
 * with requireAdmin('<something>.read') instead of deposits.manage /
 * refunds.manage — exactly the regression that shipped earlier.
 *
 * These tests introspect the real admin router stack; no database or HTTP
 * server is needed because requireAdmin attaches requiredPermissions.
 */
import { describe, expect, it } from 'vitest';
import { adminRouter } from '../../src/routes/admin.routes';
import type { AdminGateHandler } from '../../src/middleware/auth';

interface RouteGuard {
  method: string;
  path: string;
  permissions: readonly string[];
}

function isGate(handle: unknown): handle is AdminGateHandler {
  return typeof handle === 'function' &&
    Array.isArray((handle as AdminGateHandler).requiredPermissions);
}

function handlesOf(layer: { handle?: unknown; stack?: Array<{ handle: unknown }> }): unknown[] {
  const handles: unknown[] = [];
  if (layer.handle) handles.push(layer.handle);
  for (const sub of layer.stack ?? []) if (sub.handle) handles.push(sub.handle);
  return handles;
}

function collectGuards(): Array<RouteGuard & { hasGate: boolean }> {
  // Router-level gates (adminRouter.use(requireAuth, requireAdmin()))
  // apply to every route registered below them.
  const routerLevel: readonly string[] = [];
  for (const layer of adminRouter.stack) {
    if (layer.route) continue;
    for (const handle of handlesOf(layer)) {
      if (isGate(handle)) routerLevel.push(...handle.requiredPermissions);
    }
  }
  const guards: Array<RouteGuard & { hasGate: boolean }> = [];
  for (const layer of adminRouter.stack) {
    if (!layer.route) continue;
    const route = layer.route as {
      path: string;
      methods: Record<string, boolean>;
      stack: Array<{ handle: unknown }>;
    };
    const method = Object.keys(route.methods).find((m) => route.methods[m]) ?? 'unknown';
    const routeGates = route.stack.map((l) => l.handle).filter(isGate);
    const routePermissions = routeGates.flatMap((g) => [...g.requiredPermissions]);
    guards.push({
      method: method.toUpperCase(),
      path: route.path,
      permissions: [...new Set([...routerLevel, ...routePermissions])],
      hasGate: routerLevel.length > 0 || routeGates.length > 0,
    });
  }
  return guards;
}

function guardFor(method: string, path: string): RouteGuard | undefined {
  return collectGuards().find((g) => g.method === method && g.path === path);
}

const MANAGE_GATED: Array<[string, string, string]> = [
  ['POST', '/admin/deposits/:id/assign-bank', 'deposits.manage'],
  ['POST', '/admin/deposits/:id/verify-credit', 'deposits.manage'],
  ['POST', '/admin/deposits/:id/reject', 'deposits.manage'],
  ['GET', '/admin/receiving-banks', 'deposits.manage'],
  ['POST', '/admin/receiving-banks', 'deposits.manage'],
  ['POST', '/admin/receiving-banks/:id/approve', 'deposits.manage'],
  ['POST', '/admin/receiving-banks/:id/reject', 'deposits.manage'],
  ['POST', '/admin/refunds', 'refunds.manage'],
  ['POST', '/admin/refunds/:id/approve', 'refunds.manage'],
  ['POST', '/admin/refunds/:id/reject', 'refunds.manage'],
];

const READ_ONLY_KEEPERS: Array<[string, string]> = [
  ['GET', '/admin/deposits'],
  ['GET', '/admin/deposits/queue'],
  ['GET', '/admin/refunds'],
  ['GET', '/admin/currencies'],
];

describe('admin money-movement permission contract', () => {
  it('gates every money-moving operation with a manage-level permission', () => {
    for (const [method, path, permission] of MANAGE_GATED) {
      const guard = guardFor(method, path);
      expect(guard, `${method} ${path} must exist`).toBeTruthy();
      expect(guard!.permissions, `${method} ${path} must require ${permission}`)
        .toContain(permission);
    }
  });

  it('never grants money-moving routes with a read-only permission alone', () => {
    for (const [method, path] of MANAGE_GATED.map(([m, p]) => [m, p] as [string, string])) {
      const guard = guardFor(method, path)!;
      const readPermission = guard.permissions.find((p) => p.endsWith('.read'));
      const hasManage = guard.permissions.some((p) => p.endsWith('.manage'));
      expect(hasManage, `${method} ${path} must include a manage permission`).toBe(true);
      // A route is under-guarded when its ONLY guard is a read permission.
      expect(
        !readPermission || hasManage,
        `${method} ${path} is guarded by "${readPermission}" only`,
      ).toBe(true);
    }
  });

  it('keeps read-only monitoring endpoints available to read roles', () => {
    for (const [method, path] of READ_ONLY_KEEPERS) {
      const guard = guardFor(method, path);
      expect(guard, `${method} ${path} must exist`).toBeTruthy();
      expect(guard!.permissions.some((p) => p.endsWith('.manage')),
        `${method} ${path} must stay readable without manage rights`).toBe(false);
    }
  });

  it('enforces a permission on every admin route (deny by default)', () => {
    for (const guard of collectGuards()) {
      expect(guard.hasGate,
        `${guard.method} ${guard.path} has no admin permission gate`).toBe(true);
    }
  });
});
