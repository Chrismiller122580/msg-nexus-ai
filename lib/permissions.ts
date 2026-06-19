export const ROLES = ['user', 'support', 'billing', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'dashboard.view'
  | 'users.read'
  | 'users.write'
  | 'users.roles'
  | 'subscriptions.read'
  | 'subscriptions.write'
  | 'connections.read'
  | 'connections.write'
  | 'audit.read'
  | 'analytics.read'
  | 'api_keys.read'
  | 'api_keys.write'
  | 'webhooks.read'
  | 'webhooks.write'
  | 'billing.manage'
  | 'userlens.read'
  | 'userlens.write';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user: [],
  support: [
    'dashboard.view',
    'users.read',
    'users.write',
    'connections.read',
    'connections.write',
    'audit.read',
    'analytics.read',
    'userlens.read',
  ],
  billing: [
    'dashboard.view',
    'users.read',
    'subscriptions.read',
    'subscriptions.write',
    'audit.read',
    'analytics.read',
    'billing.manage',
  ],
  admin: [
    'dashboard.view',
    'users.read',
    'users.write',
    'users.roles',
    'subscriptions.read',
    'subscriptions.write',
    'connections.read',
    'connections.write',
    'audit.read',
    'analytics.read',
    'api_keys.read',
    'api_keys.write',
    'webhooks.read',
    'webhooks.write',
    'billing.manage',
    'userlens.read',
    'userlens.write',
  ],
};

export function normalizeRole(role: string | null | undefined): Role {
  if (role && ROLES.includes(role as Role)) return role as Role;
  return 'user';
}

export function getRolePermissions(role: string | null | undefined): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)] ?? [];
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

export function isStaffRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'support' || r === 'billing';
}

export const ADMIN_NAV: Array<{ href: string; label: string; permission: Permission }> = [
  { href: '/admin', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/admin/users', label: 'Users', permission: 'users.read' },
  { href: '/admin/subscriptions', label: 'Subscriptions', permission: 'subscriptions.read' },
  { href: '/admin/connections', label: 'Connections', permission: 'connections.read' },
  { href: '/admin/audit', label: 'Audit log', permission: 'audit.read' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics.read' },
  { href: '/admin/api', label: 'API keys', permission: 'api_keys.read' },
  { href: '/admin/webhooks', label: 'Webhooks', permission: 'webhooks.read' },
  { href: '/admin/userlens', label: 'UserLens', permission: 'userlens.read' },
];