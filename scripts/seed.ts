/**
 * Idempotent bootstrap: syncs indexes, upserts the system roles from the
 * permission catalog, and creates the super admin.
 *
 * Run with:  npm run seed
 *
 * Imports models directly rather than going through src/lib/db.ts — that module
 * pulls in `server-only`, which throws outside a Next bundle by design.
 */
import mongoose from 'mongoose'
import { hash } from '@node-rs/argon2'

import { ALL_PERMISSIONS, VIEW_PERMISSIONS, type Permission } from '../src/lib/permissions'
import { Role } from '../src/models/Role'
import { User } from '../src/models/User'
import '../src/models'

const SYSTEM_ROLES: {
  key: string
  name: string
  description: string
  permissions: Permission[]
}[] = [
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Full access to everything except transferring ownership.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description: 'Runs projects and their delivery.',
    permissions: [
      'project.view', 'project.create', 'project.update', 'project.archive',
      'client.view', 'client.create', 'client.update',
      'deal.view',
      'service.view',
      'invoice.view',
      'expense.view', 'expense.create',
      'member.view',
    ],
  },
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Owns invoicing, payments, expenses and the rate card.',
    permissions: [
      'invoice.view', 'invoice.create', 'invoice.update', 'invoice.send', 'invoice.void',
      'payment.view', 'payment.record',
      'expense.view', 'expense.create', 'expense.approve',
      'service.view', 'service.create', 'service.update', 'service.delete',
      'client.view', 'project.view', 'member.view',
      'audit.view',
    ],
  },
  {
    key: 'sales_manager',
    name: 'Sales Manager',
    description: 'Owns the pipeline and client relationships.',
    permissions: [
      'deal.view', 'deal.create', 'deal.update', 'deal.changeStage', 'deal.delete',
      'client.view', 'client.create', 'client.update', 'client.delete',
      'service.view',
      'project.view',
      'invoice.view',
      'member.view',
    ],
  },
  {
    key: 'member',
    name: 'Team Member',
    description: 'Works on projects they are assigned to.',
    permissions: ['project.view', 'client.view', 'deal.view', 'service.view', 'expense.view', 'expense.create'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only across the workspace.',
    permissions: VIEW_PERMISSIONS,
  },
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local first.')

  console.log('→ connecting…')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })

  // Builds the partial unique indexes (one super admin, one pending invite per
  // email) and the session TTL. Without this they simply do not exist.
  console.log('→ syncing indexes…')
  for (const name of Object.keys(mongoose.models)) {
    await mongoose.models[name].syncIndexes()
    console.log(`   ✓ ${name}`)
  }

  // One-time cleanup: `rank` was removed from the schema, so strip it from any
  // documents seeded before that. Mongo keeps unknown fields otherwise.
  const stripped = await Role.updateMany({ rank: { $exists: true } }, { $unset: { rank: '' } })
  if (stripped.modifiedCount) console.log(`→ dropped rank from ${stripped.modifiedCount} role(s)`)

  console.log('→ upserting system roles…')
  for (const role of SYSTEM_ROLES) {
    // $set (not replace) so catalog changes propagate to existing roles while
    // the _id stays stable — users reference roles by id.
    await Role.updateOne(
      { key: role.key },
      {
        $set: {
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: true,
        },
      },
      { upsert: true },
    )
    console.log(`   ✓ ${role.key} (${role.permissions.length} permissions)`)
  }

  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim()
  const password = process.env.SUPER_ADMIN_PASSWORD
  const name = process.env.SUPER_ADMIN_NAME ?? 'Owner'

  if (!email || !password) {
    console.log('→ skipping super admin (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set)')
  } else {
    const existing = await User.findOne({ isSuperAdmin: true }).lean()
    if (existing) {
      console.log(`→ super admin already exists: ${existing.email}`)
    } else {
      await User.create({
        email,
        name,
        passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        isSuperAdmin: true,
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: [],
      })
      console.log(`→ created super admin: ${email}`)
      console.log('  ⚠ change this password after first login, and clear it from .env.local')
    }
  }

  await mongoose.disconnect()
  console.log('✓ seed complete')
}

main().catch(async (err) => {
  console.error('✗ seed failed:', err instanceof Error ? err.message : err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
