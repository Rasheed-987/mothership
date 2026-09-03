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
import { Project } from '../src/models/Project'
import { Deal } from '../src/models/Deal'
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

  // Seed default admin account requested for testing: waleed@humansaucer.com / Human1234@
  const waleedEmail = 'waleed@humansaucer.com'
  const waleedExisting = await User.findOne({ email: waleedEmail }).lean()
  if (!waleedExisting) {
    const adminRole = await Role.findOne({ key: 'admin' }).lean()
    await User.create({
      email: waleedEmail,
      name: 'Waleed',
      passwordHash: await hash('Human1234@', { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      isSuperAdmin: false,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: adminRole ? [{ roleId: adminRole._id, assignedAt: new Date() }] : [],
    })
    console.log(`→ created account: ${waleedEmail}`)
  } else {
    console.log(`→ account already exists: ${waleedEmail}`)
  }

  // Seed initial clients if Client collection is empty
  const { Client } = await import('../src/models/Client')
  const clientCount = await Client.countDocuments()
  if (clientCount === 0) {
    console.log('→ seeding initial client registry…')
    const creator = (await User.findOne({ isSuperAdmin: true }).lean()) || (await User.findOne({ email: waleedEmail }).lean())
    if (creator) {
      const SEED_CLIENTS = [
        { name: 'One Health', industry: 'Healthcare', status: 'active', address: { country: 'UAE' }, contacts: [{ name: 'Dr. Tariq', email: 'tariq@onehealth.ae', phone: '+971 50 118 4420', isPrimary: true }] },
        { name: 'PureHealth', industry: 'Health', status: 'active', address: { country: 'UAE' }, contacts: [{ name: 'Omar Nasser', email: 'omar@purehealth.ae', phone: '+971 53 137 1271', isPrimary: true }] },
        { name: 'GLP', industry: 'Government', status: 'active', address: { country: 'UAE' }, contacts: [{ name: 'Khalid Al Mansoori', email: 'khalid@glp.gov.ae', isPrimary: true }] },
        { name: 'Zeyra Glow', industry: 'Beauty & Cosmetics', status: 'active', address: { country: 'UAE' }, contacts: [{ name: 'Zeyneb', email: 'contact@zeyraglow.com', isPrimary: true }] },
        { name: 'Rove Resorts', industry: 'Hospitality', status: 'active', address: { country: 'UAE' }, contacts: [{ name: 'Marc Ross', email: 'marc@roveresorts.com', isPrimary: true }] },
        { name: 'Rove', industry: 'Hospitality', status: 'inactive', address: { country: 'UAE' }, contacts: [{ name: 'Marc Ross', email: 'marc@rove.com', isPrimary: true }] },
        { name: 'Department of Finance', industry: 'Government', status: 'lead', address: { country: 'UAE' }, contacts: [{ name: 'Saeed Al Maktoum', email: 'saeed@dof.gov.ae', isPrimary: true }] },
        { name: 'Rafed', industry: 'Healthcare', status: 'lead', address: { country: 'UAE' }, contacts: [{ name: 'Hamed Al Mazrouei', email: 'hamed@rafed.ae', isPrimary: true }] },
        { name: 'Colorland Toys', industry: 'Retail', status: 'lead', address: { country: 'UAE' }, contacts: [{ name: 'Fatima', email: 'fatima@colorland.ae', isPrimary: true }] },
        { name: 'Al Maryah Community', industry: 'Healthcare', status: 'lead', address: { country: 'UAE' }, contacts: [{ name: 'Omar', email: 'omar@almaryah.ae', isPrimary: true }] },
        { name: 'Dubai Municipality', industry: 'Government', status: 'lead', address: { country: 'UAE' }, contacts: [{ name: 'Rashid', email: 'rashid@dm.gov.ae', isPrimary: true }] },
        { name: 'ElephantSkin', industry: 'Sustainable Gloves', status: 'archived', address: { country: 'Brazil' }, contacts: [{ name: 'Lucas', email: 'lucas@elephantskin.com', isPrimary: true }] },
      ]
      for (const c of SEED_CLIENTS) {
        await Client.create({
          ...c,
          createdBy: creator._id,
        })
      }
      console.log(`   ✓ seeded ${SEED_CLIENTS.length} clients`)
    }
  }

  // Seed initial projects if Project collection is empty
  const projectCount = await Project.countDocuments()
  if (projectCount === 0) {
    console.log('→ seeding initial projects…')
    const creator =
      (await User.findOne({ isSuperAdmin: true }).lean()) || (await User.findOne({ email: waleedEmail }).lean())
    const waleed = await User.findOne({ email: waleedEmail }).lean()
    const clients = await Client.find().lean()
    const clientId = (name: string) => clients.find((c) => c.name === name)?._id

    if (creator && waleed) {
      const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

      const SEED_PROJECTS = [
        {
          name: 'Brand Uplift for SEHA Hospitals',
          client: 'PureHealth',
          category: 'Branding',
          value: 200_000,
          status: 'active',
          health: 'behind',
          daysBehind: 6,
          revisionRounds: 2,
          plannedDuration: '12 weeks',
          startDate: D('2026-05-05'),
          dueDate: D('2026-07-31'),
          progressNote: 'Awaiting asset sign-off, slipping',
          trackerUpdatedAt: D('2026-06-24'),
          delayNote:
            'Identity sign-off is 6 days late. Every day pushes the 31 July launch by the same amount.',
          remarks: 'Largest active account.',
          clientVisible: true,
          resources: [
            { label: 'Proposal', url: 'https://drive.google.com/', kind: 'proposal' },
            { label: 'Client Folder', url: 'https://drive.google.com/', kind: 'drive' },
            { label: 'Client Resources', url: 'https://drive.google.com/', kind: 'drive' },
            { label: 'Figma', url: 'https://figma.com/', kind: 'figma' },
          ],
          stages: [
            { name: 'Discovery', note: 'Stakeholder workshops', owner: 'Human Saucer', state: 'done' },
            { name: 'Strategy', note: 'Brand platform', owner: 'Human Saucer', state: 'done' },
            { name: 'Identity design', note: 'Logo system & guidelines', owner: 'Human Saucer', state: 'active' },
            { name: 'Collateral', note: 'Templates & signage', owner: 'Human Saucer', state: 'upcoming', duration: '3 weeks', targetDate: D('2026-07-18') },
            { name: 'Rollout kit', note: 'Handover assets', owner: 'Human Saucer', state: 'upcoming', targetDate: D('2026-07-28') },
            { name: 'Go live', note: 'Brand launch', owner: 'PureHealth', state: 'upcoming', targetDate: D('2026-07-31') },
          ],
          activity: [
            { occurredOn: D('2026-06-18'), text: 'Round 2 concepts shared', pending: false },
            { occurredOn: D('2026-06-20'), text: 'Awaiting brand asset sign-off', pending: true },
          ],
          clientAsks: [
            { title: 'Approve identity direction', note: 'Sign-off unblocks collateral.', dueOn: D('2026-06-24'), received: false },
            { title: 'Hospital photography', note: 'Approved image library.', dueOn: D('2026-06-20'), received: true },
          ],
        },
        {
          name: 'One Health Web Design & Development',
          client: 'One Health',
          category: 'Web Design & Development',
          value: 95_000,
          status: 'active',
          health: 'on_track',
          daysBehind: 0,
          revisionRounds: 1,
          plannedDuration: '8 weeks',
          startDate: D('2026-06-24'),
          dueDate: D('2026-08-31'),
          progressNote: 'Sitemap done, revising the concept',
          trackerUpdatedAt: D('2026-06-26'),
          delayNote: '',
          remarks: 'PureHealth group. Reference client page.',
          clientVisible: true,
          resources: [
            { label: 'Client Folder', url: 'https://drive.google.com/', kind: 'drive' },
            { label: 'Figma', url: 'https://figma.com/', kind: 'figma' },
          ],
          stages: [
            { name: 'Sitemap', note: '14 pages', owner: 'Human Saucer', state: 'done' },
            { name: 'Creative concept', note: 'Revised concept due 29 June', owner: 'Human Saucer', state: 'active' },
            { name: 'Copywriting', note: '14 pages, English only', owner: 'Human Saucer', state: 'upcoming', duration: '1 week' },
            { name: 'UI & UX design', note: 'Desktop and mobile', owner: 'Human Saucer', state: 'upcoming', duration: '3 weeks' },
            { name: 'Development & QA', note: 'Next.js, Vercel, MongoDB', owner: 'Human Saucer', state: 'upcoming', duration: '4 weeks' },
            { name: 'Go live', note: 'Handover then live', owner: 'One Health', state: 'upcoming', targetDate: D('2026-08-31') },
          ],
          activity: [
            { occurredOn: D('2026-06-24'), text: 'Purchase order issued, project confirmed', pending: false },
            { occurredOn: D('2026-06-26'), text: 'Landing page concept feedback returned', pending: false },
            { occurredOn: D('2026-06-29'), text: 'Revised landing page concept due', pending: true },
          ],
          clientAsks: [
            { title: 'Approve the revised concept', note: 'Sign-off starts the design phase.', dueOn: D('2026-06-29'), received: false },
            { title: 'Sign off on privacy and terms', note: 'PureHealth template received.', dueOn: D('2026-06-24'), received: true },
          ],
        },
        {
          name: 'GLP Web Design & Development',
          client: 'GLP',
          category: 'Web Design & Development',
          value: 125_000,
          status: 'active',
          health: 'on_track',
          daysBehind: 0,
          revisionRounds: 1,
          plannedDuration: '10 weeks',
          startDate: D('2026-05-19'),
          dueDate: D('2026-08-15'),
          progressNote: 'Copywriting underway',
          trackerUpdatedAt: D('2026-06-25'),
          delayNote: '',
          remarks: '',
          clientVisible: true,
          resources: [{ label: 'Client Folder', url: 'https://drive.google.com/', kind: 'drive' }],
          stages: [
            { name: 'Discovery', note: 'Workshops', owner: 'Human Saucer', state: 'done' },
            { name: 'Copywriting', note: 'Bilingual', owner: 'Human Saucer', state: 'active' },
            { name: 'Design', note: 'Desktop and mobile', owner: 'Human Saucer', state: 'upcoming', duration: '3 weeks' },
            { name: 'Build & QA', note: 'CMS build', owner: 'Human Saucer', state: 'upcoming', duration: '4 weeks' },
            { name: 'Go live', note: 'Launch', owner: 'GLP', state: 'upcoming', targetDate: D('2026-08-15') },
          ],
          activity: [{ occurredOn: D('2026-06-23'), text: 'Arabic content requested', pending: true }],
          clientAsks: [{ title: 'Outstanding Arabic content', note: 'Needed to keep the launch date.', dueOn: null, received: false }],
        },
        {
          name: 'Longevity Clinic Branding',
          client: 'PureHealth',
          category: 'Branding',
          value: 125_000,
          status: 'active',
          health: 'on_track',
          daysBehind: 0,
          revisionRounds: 0,
          plannedDuration: '9 weeks',
          startDate: D('2026-05-26'),
          dueDate: D('2026-08-20'),
          progressNote: 'Concept territories in review',
          trackerUpdatedAt: D('2026-06-24'),
          delayNote: '',
          remarks: '',
          clientVisible: true,
          resources: [{ label: 'Client Folder', url: 'https://drive.google.com/', kind: 'drive' }],
          stages: [
            { name: 'Discovery', note: 'Workshops', owner: 'Human Saucer', state: 'done' },
            { name: 'Concept territories', note: 'Three routes', owner: 'Human Saucer', state: 'active' },
            { name: 'Identity design', note: 'Chosen route', owner: 'Human Saucer', state: 'upcoming', duration: '3 weeks' },
            { name: 'Guidelines', note: 'Brand book', owner: 'Human Saucer', state: 'upcoming', duration: '2 weeks' },
            { name: 'Handover', note: 'Asset delivery', owner: 'PureHealth', state: 'upcoming', targetDate: D('2026-08-20') },
          ],
          activity: [{ occurredOn: D('2026-06-22'), text: 'Concept territories shared for review', pending: true }],
          clientAsks: [{ title: 'Select a concept territory', note: 'Keeps the 20 August handover on track.', dueOn: null, received: false }],
        },
        {
          name: 'OneHealth Branding',
          client: 'PureHealth',
          category: 'Branding',
          value: 125_000,
          status: 'completed',
          health: 'on_track',
          daysBehind: 0,
          revisionRounds: 3,
          plannedDuration: '12 weeks',
          startDate: D('2026-02-01'),
          dueDate: D('2026-04-28'),
          progressNote: 'Delivered',
          trackerUpdatedAt: D('2026-04-28'),
          delayNote: '',
          remarks: 'Delivered on time.',
          clientVisible: false,
          resources: [],
          stages: [
            { name: 'Discovery', note: 'Workshops', owner: 'Human Saucer', state: 'done' },
            { name: 'Strategy', note: 'Brand platform', owner: 'Human Saucer', state: 'done' },
            { name: 'Identity design', note: 'Full system', owner: 'Human Saucer', state: 'done' },
            { name: 'Guidelines', note: 'Brand book', owner: 'Human Saucer', state: 'done' },
            { name: 'Handover', note: 'Delivered', owner: 'PureHealth', state: 'done' },
          ],
          activity: [{ occurredOn: D('2026-04-28'), text: 'Final assets delivered', pending: false }],
          clientAsks: [],
        },
        {
          name: 'Rove Resorts Web Design & Development',
          client: 'Rove Resorts',
          category: 'Web Design & Development',
          value: 80_000,
          status: 'planning',
          health: 'on_track',
          daysBehind: 0,
          revisionRounds: 0,
          plannedDuration: '10 weeks',
          startDate: D('2026-07-14'),
          dueDate: D('2026-10-01'),
          progressNote: 'Kickoff scheduled 14 July',
          trackerUpdatedAt: null,
          delayNote: '',
          remarks: 'Kickoff scheduled.',
          clientVisible: false,
          resources: [],
          stages: [],
          activity: [],
          clientAsks: [],
        },
      ]

      let made = 0
      for (const p of SEED_PROJECTS) {
        const cId = clientId(p.client)
        if (!cId) {
          console.log(`   ⚠ skipped "${p.name}" — client "${p.client}" not found`)
          continue
        }
        const { client: _client, value, category, ...rest } = p
        const slug = p.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
        await Project.create({
          ...rest,
          code: `PRJ-${slug}`,
          clientId: cId,
          managerId: waleed._id,
          billingType: 'fixed',
          budget: { amount: value * 100, currency: 'AED' },
          progressPct: 0,
          tags: [category],
          createdBy: creator._id,
        })
        made += 1
      }
      console.log(`   ✓ seeded ${made} projects`)
    }
  }

  // Seed initial sales-pipeline deals if Deal collection is empty
  const dealCount = await Deal.countDocuments()
  if (dealCount === 0) {
    console.log('→ seeding sales pipeline…')
    const creator =
      (await User.findOne({ isSuperAdmin: true }).lean()) || (await User.findOne({ email: waleedEmail }).lean())
    const waleed = await User.findOne({ email: waleedEmail }).lean()
    const clients = await Client.find().lean()
    const clientId = (name: string) => clients.find((c) => c.name === name)?._id

    if (creator && waleed) {
      // Follow-up dates are placed relative to "now" so the overdue split is visible.
      const now = Date.now()
      const rel = (days: number) => new Date(now + days * 86_400_000)
      const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

      const SEED_DEALS = [
        {
          title: 'Web Design & Development',
          client: 'Department of Finance',
          category: 'Web Design & Development',
          stage: 'proposal',
          confidence: 'high',
          value: 210_000,
          probability: 50,
          nextFollowUpDate: rel(-3),
          expectedCloseDate: D('2026-10-15'),
          source: 'Inbound RFP for the DoF website revamp.',
          notes: [
            { text: 'Inbound RFP for the DoF website revamp.', at: D('2026-05-28') },
            { text: 'Discovery call — ~40 pages, bilingual, accessibility mandate.', at: D('2026-06-04') },
            { text: 'Shared indicative scope + timeline; positive response.', at: D('2026-06-12') },
            { text: 'Proposal sent (AED 210k), strong intent. Chase after exec review.', at: D('2026-06-18') },
          ],
        },
        {
          title: 'Branding Guidelines',
          client: 'Rafed',
          category: 'Branding',
          stage: 'proposal',
          confidence: 'low',
          value: 165_000,
          probability: 25,
          nextFollowUpDate: rel(-6),
          expectedCloseDate: D('2026-10-01'),
          source: 'Intro via PureHealth referral — branding guidelines.',
          notes: [
            { text: 'Intro via PureHealth referral — branding guidelines.', at: D('2026-05-30') },
            { text: 'Brand audit walkthrough; liked our healthcare work.', at: D('2026-06-04') },
            { text: 'Proposal sent (AED 165k). Budget under review on their side.', at: D('2026-06-10') },
          ],
        },
        {
          title: 'Social Media Management',
          client: 'Colorland Toys',
          category: 'Social Media',
          stage: 'proposal',
          confidence: 'low',
          value: 10_500,
          probability: 25,
          nextFollowUpDate: rel(5),
          expectedCloseDate: D('2026-09-30'),
          source: 'Inbound enquiry — social media management (retail).',
          notes: [
            { text: 'Inbound enquiry — social media management (retail).', at: D('2026-06-05') },
            { text: 'Scoped 3 platforms + monthly content calendar.', at: D('2026-06-09') },
            { text: 'Monthly retainer proposal sent.', at: D('2026-06-12') },
          ],
        },
        {
          title: 'Web Design & Development',
          client: 'Al Maryah Community',
          category: 'Web Design & Development',
          stage: 'lead',
          confidence: 'high',
          value: 90_000,
          probability: 10,
          nextFollowUpDate: rel(-4),
          expectedCloseDate: null,
          source: 'Warm intro — healthcare community web platform.',
          notes: [
            { text: 'Warm intro — healthcare community web platform.', at: D('2026-06-08') },
            { text: 'Intro call done; scoping content + integration needs.', at: D('2026-06-15') },
          ],
        },
        {
          title: 'Branding Identity',
          client: 'Dubai Municipality',
          category: 'Branding',
          stage: 'lead',
          confidence: 'low',
          value: 60_000,
          probability: 10,
          nextFollowUpDate: rel(9),
          expectedCloseDate: null,
          source: 'Early enquiry for a branding identity refresh.',
          notes: [
            { text: 'Early enquiry for a branding identity refresh.', at: D('2026-06-11') },
            { text: 'Exploratory call; awaiting an internal brief.', at: D('2026-06-16') },
          ],
        },
        {
          title: 'B2B Marketing',
          client: 'ElephantSkin',
          category: 'Marketing',
          stage: 'lost',
          confidence: 'low',
          value: 9_000,
          probability: 0,
          nextFollowUpDate: null,
          expectedCloseDate: D('2026-05-20'),
          source: 'Went with another agency.',
          notes: [{ text: 'Went with another agency.', at: D('2026-05-20') }],
        },
      ]

      let made = 0
      for (const d of SEED_DEALS) {
        const cId = clientId(d.client)
        if (!cId) {
          console.log(`   ⚠ skipped "${d.title}" — client "${d.client}" not found`)
          continue
        }
        const { client: _client, value, category, notes, ...rest } = d
        const stamped = notes.map((n) => ({ ...n, byUserId: waleed._id }))
        await Deal.create({
          ...rest,
          clientId: cId,
          value: { amount: value * 100, currency: 'AED' },
          tags: [category],
          ownerId: waleed._id,
          notes: stamped,
          lastContactedAt: stamped.length ? stamped[stamped.length - 1].at : null,
          createdBy: creator._id,
        })
        made += 1
      }
      console.log(`   ✓ seeded ${made} deals`)
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
