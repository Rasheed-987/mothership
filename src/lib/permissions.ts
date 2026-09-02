/**
 * The permission catalog. This file is the single source of truth.
 *
 * Mongo has no foreign keys, so there is no `permissions` collection — a role
 * just stores these strings in an array, and writes are validated against
 * ALL_PERMISSIONS at the model layer.
 *
 * Adding a permission here makes it available to the role builder immediately.
 * Removing one requires pulling it from existing roles (see scripts/seed.ts).
 */
export const PERMISSIONS = {
  // Team
  'member.view': 'View team members',
  'member.invite': 'Invite people to the workspace',
  'member.remove': 'Remove team members',
  'member.suspend': 'Suspend or reactivate members',

  // Roles
  'role.view': 'View roles and their permissions',
  'role.create': 'Create custom roles',
  'role.update': 'Edit a role’s permissions',
  'role.delete': 'Delete custom roles',
  'role.assign': 'Assign roles to members',

  // Clients
  'client.view': 'View clients',
  'client.create': 'Add clients',
  'client.update': 'Edit clients',
  'client.delete': 'Delete clients',

  // Sales pipeline
  'deal.view': 'View the sales pipeline',
  'deal.create': 'Create deals',
  'deal.update': 'Edit deals',
  'deal.changeStage': 'Move deals between stages',
  'deal.delete': 'Delete deals',

  // Pricing (rate card)
  'service.view': 'View the rate card',
  'service.create': 'Add services and rates',
  'service.update': 'Edit services and rates',
  'service.delete': 'Delete services',

  // Projects
  'project.view': 'View projects',
  'project.create': 'Create projects',
  'project.update': 'Edit projects',
  'project.archive': 'Complete or archive projects',
  'project.delete': 'Delete projects',

  // Financials — invoicing
  'invoice.view': 'View invoices',
  'invoice.create': 'Create invoices',
  'invoice.update': 'Edit draft invoices',
  'invoice.send': 'Send invoices to clients',
  'invoice.void': 'Void invoices',

  // Financials — money in
  'payment.view': 'View payments',
  'payment.record': 'Record payments against invoices',

  // Financials — money out
  'expense.view': 'View expenses',
  'expense.create': 'Submit expenses',
  'expense.approve': 'Approve or reject expenses',

  // Workspace
  'audit.view': 'View the audit log',
  'settings.view': 'View workspace settings',
  'settings.update': 'Change workspace settings',
} as const

export type Permission = keyof typeof PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS
}

/** Grouping drives the role-builder UI; the resource prefix is the group key. */
export const PERMISSION_GROUPS: { key: string; label: string; permissions: Permission[] }[] = [
  { key: 'member', label: 'Team' },
  { key: 'role', label: 'Roles & access' },
  { key: 'client', label: 'Clients' },
  { key: 'deal', label: 'Sales pipeline' },
  { key: 'service', label: 'Pricing' },
  { key: 'project', label: 'Projects' },
  { key: 'invoice', label: 'Invoicing' },
  { key: 'payment', label: 'Payments' },
  { key: 'expense', label: 'Expenses' },
  { key: 'audit', label: 'Audit log' },
  { key: 'settings', label: 'Settings' },
].map((g) => ({
  ...g,
  permissions: ALL_PERMISSIONS.filter((p) => p.split('.')[0] === g.key),
}))

/** Every read-only permission — the basis of the `viewer` role. */
export const VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith('.view'))
