import 'server-only'
import { z } from 'zod'
import { isValidObjectId, Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { audit } from '@/lib/audit'
import { Service } from '@/models/Service'
import { Project, type IPricingSheet, type IPricingResource } from '@/models/Project'
import { Client } from '@/models/Client'
import { CLIENT_TIERS, type ClientTier } from '@/models/shared'
import type { CurrentUser } from '@/lib/authz'
import { ServiceError } from './roles'
export { ServiceError } from './roles'

/* ============================================================================
 * The rate card — Service rows with a day rate per client tier.
 * ========================================================================= */

export type TierRates = Record<ClientTier, number>
export type DayRates = { byId: Map<string, TierRates>; byName: Map<string, TierRates> }

export type RateCardEntryDTO = {
  id: string
  code: string
  name: string
  note: string
  category: string
  isActive: boolean
  /** Day rate in AED per tier. Hourly is day / 8. */
  day: TierRates
}

const HOURS_PER_DAY = 8

function money(amount?: number): number {
  return amount ? amount / 100 : 0
}

function emptyTiers(): TierRates {
  return { small: 0, medium: 0, large: 0 }
}

/** Load every rate-card day rate, keyed by both Service id and lowercased name. */
export async function loadDayRates(): Promise<DayRates> {
  await connectDB()
  const services = await Service.find({ 'tierRates.0': { $exists: true } })
    .select('name tierRates')
    .lean()

  const byId = new Map<string, TierRates>()
  const byName = new Map<string, TierRates>()
  for (const s of services) {
    const rec = emptyTiers()
    for (const tr of s.tierRates ?? []) rec[tr.tier] = money(tr.dayRate?.amount)
    byId.set(String(s._id), rec)
    byName.set(s.name.trim().toLowerCase(), rec)
  }
  return { byId, byName }
}

export async function listRateCard(): Promise<RateCardEntryDTO[]> {
  await connectDB()
  const services = await Service.find().sort({ name: 1 }).lean()
  return services.map((s) => {
    const day = emptyTiers()
    for (const tr of s.tierRates ?? []) day[tr.tier] = money(tr.dayRate?.amount)
    return {
      id: String(s._id),
      code: s.code,
      name: s.name,
      note: s.description || '',
      category: s.category || 'Role',
      isActive: s.isActive,
      day,
    }
  })
}

const hourlyTiers = z.object({
  small: z.coerce.number().min(0).max(1e7),
  medium: z.coerce.number().min(0).max(1e7),
  large: z.coerce.number().min(0).max(1e7),
})

export const rateCardEntrySchema = z.object({
  name: z.string().trim().min(1, { message: 'Name the role.' }).max(120),
  note: z.string().trim().max(300).optional().default(''),
  category: z.string().trim().max(60).optional().default('Role'),
  /** Hourly rate per tier, in AED. Day rate is stored as hourly × 8. */
  hourly: hourlyTiers,
})
export type RateCardEntryInput = z.infer<typeof rateCardEntrySchema>
export const updateRateCardEntrySchema = rateCardEntrySchema.partial()
export type UpdateRateCardEntryInput = z.infer<typeof updateRateCardEntrySchema>

function tierRatesFromHourly(hourly: { small: number; medium: number; large: number }) {
  return (CLIENT_TIERS as readonly ClientTier[]).map((tier) => ({
    tier,
    hourlyRate: { amount: Math.round(hourly[tier] * 100), currency: 'AED' },
    dayRate: { amount: Math.round(hourly[tier] * HOURS_PER_DAY * 100), currency: 'AED' },
  }))
}

async function uniqueServiceCode(name: string): Promise<string> {
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'ROLE'
  const base = `ROLE-${slug}`
  let code = base
  let n = 1
  while (await Service.exists({ code })) {
    n += 1
    code = `${base}-${n}`
  }
  return code
}

export async function createRateCardEntry(actor: CurrentUser, input: RateCardEntryInput) {
  await connectDB()
  const code = await uniqueServiceCode(input.name)
  const tierRates = tierRatesFromHourly(input.hourly)
  const service = await Service.create({
    code,
    name: input.name,
    description: input.note || undefined,
    category: input.category,
    pricingModel: 'daily',
    rate: tierRates[0].dayRate,
    tierRates,
    unit: 'day',
    taxRatePct: 0,
    isActive: true,
    createdBy: actor.id,
  })
  await audit({
    actorId: actor.id,
    action: 'service.created',
    targetType: 'Service',
    targetId: String(service._id),
    metadata: { name: service.name },
  })
  return { id: String(service._id), name: service.name }
}

export async function updateRateCardEntry(actor: CurrentUser, serviceId: string, input: UpdateRateCardEntryInput) {
  await connectDB()
  const service = await Service.findById(serviceId)
  if (!service) throw new ServiceError('Rate-card entry not found.', 404)

  if (input.name !== undefined) service.name = input.name
  if (input.note !== undefined) service.description = input.note || undefined
  if (input.category !== undefined) service.category = input.category
  if (input.hourly) {
    const tierRates = tierRatesFromHourly(input.hourly)
    service.tierRates = tierRates
    service.rate = tierRates[0].dayRate
  }

  await service.save()
  await audit({
    actorId: actor.id,
    action: 'service.updated',
    targetType: 'Service',
    targetId: String(service._id),
    metadata: { name: service.name },
  })
  return { id: String(service._id), name: service.name }
}

export async function deleteRateCardEntry(actor: CurrentUser, serviceId: string) {
  await connectDB()
  const service = await Service.findById(serviceId)
  if (!service) throw new ServiceError('Rate-card entry not found.', 404)
  await service.deleteOne()
  await audit({
    actorId: actor.id,
    action: 'service.deleted',
    targetType: 'Service',
    targetId: serviceId,
    metadata: { name: service.name },
  })
}

/* ============================================================================
 * The pricing computation — port of demo `pricingCompute`.
 * ========================================================================= */

export type ResourceLine = {
  phase: string
  name: string
  role: string
  dayRate: number
  workDays: number
  allocationPct: number
  days: number
  cost: number
}
export type VendorLine = {
  vendorName: string
  description: string
  cost: number // AED, before markup
  markupPct: number // 0.4 = 40%
  markupAmount: number
  total: number
}
export type PricingComputation = {
  tier: ClientTier
  internal: number
  vendor: number
  tePct: number
  te: number
  adminPct: number
  admin: number
  total: number
  resourceLines: ResourceLine[]
  vendorLines: VendorLine[]
}

type SheetLike = Pick<IPricingSheet, 'tier' | 'tePct' | 'adminPct' | 'phases' | 'thirdParty'>

export function computePricing(sheet: SheetLike, rates: DayRates, tierOverride?: ClientTier): PricingComputation {
  const tier: ClientTier = tierOverride ?? sheet.tier ?? 'small'

  const dayRateFor = (r: IPricingResource): number => {
    if (r.serviceId) {
      const rec = rates.byId.get(String(r.serviceId))
      if (rec) return rec[tier] ?? 0
    }
    const rec = rates.byName.get((r.role ?? '').trim().toLowerCase())
    return rec ? rec[tier] ?? 0 : 0
  }

  const resourceLines: ResourceLine[] = []
  let internal = 0
  for (const ph of sheet.phases ?? []) {
    for (const r of ph.resources ?? []) {
      const dayRate = dayRateFor(r)
      const allocationPct = r.allocationPct ?? 100
      const days = (ph.workDays ?? 0) * (allocationPct / 100)
      const cost = dayRate * days
      internal += cost
      resourceLines.push({
        phase: ph.name,
        name: r.name,
        role: r.role,
        dayRate,
        workDays: ph.workDays ?? 0,
        allocationPct,
        days,
        cost,
      })
    }
  }

  const vendorLines: VendorLine[] = []
  let vendor = 0
  for (const t of sheet.thirdParty ?? []) {
    const cost = money(t.costToHs)
    const markupPct = t.markupPct ?? 0.4
    const total = cost * (1 + markupPct)
    vendor += total
    vendorLines.push({
      vendorName: t.vendorName ?? '',
      description: t.description,
      cost,
      markupPct,
      markupAmount: cost * markupPct,
      total,
    })
  }

  const tePct = sheet.tePct ?? 0.05
  const te = (internal + vendor) * tePct
  const adminPct = sheet.adminPct ?? 0.05
  const admin = (internal + te + vendor) * adminPct

  return {
    tier,
    internal,
    vendor,
    tePct,
    te,
    adminPct,
    admin,
    total: internal + te + vendor + admin,
    resourceLines,
    vendorLines,
  }
}

/** Convenience for the project page — total only, or null when there's no sheet. */
export async function suggestedPriceForProject(sheet: IPricingSheet | null | undefined): Promise<number | null> {
  if (!sheet) return null
  const rates = await loadDayRates()
  return Math.round(computePricing(sheet, rates).total)
}

/* ============================================================================
 * Per-project pricing sheets (Project.pricing).
 * ========================================================================= */

export type PricingSheetSummaryDTO = {
  projectId: string
  projectName: string
  projectCode: string
  clientName: string
  category: string
  tier: ClientTier
  submittedTier: ClientTier
  submittedPrice: number
  soldPrice: number
  gap: number
}

export type PricingResourceDTO = {
  name: string
  role: string
  serviceId: string | null
  allocationPct: number
}
export type PricingPhaseDTO = { name: string; workDays: number; resources: PricingResourceDTO[] }
export type PricingThirdPartyDTO = {
  vendorName: string
  description: string
  cost: number // AED
  markupPct: number // 0.4
}

export type PricingSheetDTO = {
  projectId: string
  projectName: string
  projectCode: string
  clientId: string
  clientName: string
  clientTier: ClientTier
  tier: ClientTier
  submittedTier: ClientTier
  isSubmitted: boolean
  tePct: number
  adminPct: number
  waitingVendor: boolean
  soldPrice: number
  computation: PricingComputation
  submittedComputation: PricingComputation
  tierTotals: Record<ClientTier, number>
  phases: PricingPhaseDTO[]
  thirdParty: PricingThirdPartyDTO[]
}

function sheetToInputDTO(sheet: IPricingSheet): { phases: PricingPhaseDTO[]; thirdParty: PricingThirdPartyDTO[] } {
  return {
    phases: (sheet.phases ?? []).map((ph) => ({
      name: ph.name,
      workDays: ph.workDays ?? 0,
      resources: (ph.resources ?? []).map((r) => ({
        name: r.name,
        role: r.role,
        serviceId: r.serviceId ? String(r.serviceId) : null,
        allocationPct: r.allocationPct ?? 100,
      })),
    })),
    thirdParty: (sheet.thirdParty ?? []).map((t) => ({
      vendorName: t.vendorName ?? '',
      description: t.description,
      cost: money(t.costToHs),
      markupPct: t.markupPct ?? 0.4,
    })),
  }
}

export async function listPricingSheets(): Promise<PricingSheetSummaryDTO[]> {
  await connectDB()
  const [projects, clients, rates] = await Promise.all([
    Project.find({ pricing: { $ne: null } }).sort({ updatedAt: -1 }).lean(),
    Client.find().select('name').lean(),
    loadDayRates(),
  ])
  const nameById = new Map(clients.map((c) => [String(c._id), c.name]))

  return projects
    .filter((p) => p.pricing)
    .map((p) => {
      const sheet = p.pricing as IPricingSheet
      const submittedTier = (sheet.submittedTier ?? sheet.tier) as ClientTier
      const submittedPrice = Math.round(computePricing(sheet, rates, submittedTier).total)
      const soldPrice = money(p.budget?.amount)
      return {
        projectId: String(p._id),
        projectName: p.name,
        projectCode: p.code,
        clientName: nameById.get(String(p.clientId)) || '—',
        category: p.tags?.[0] || 'General',
        tier: sheet.tier ?? 'small',
        submittedTier,
        submittedPrice,
        soldPrice,
        gap: soldPrice - submittedPrice,
      }
    })
}

export async function getPricingSheet(projectId: string): Promise<PricingSheetDTO | null> {
  await connectDB()
  const project = isValidObjectId(projectId)
    ? await Project.findById(projectId).lean()
    : await Project.findOne({ code: projectId.toUpperCase() }).lean()
  if (!project || !project.pricing) return null

  const sheet = project.pricing as IPricingSheet
  const [client, rates] = await Promise.all([
    Client.findById(project.clientId).select('name tier').lean(),
    loadDayRates(),
  ])

  const tier = (sheet.tier ?? 'small') as ClientTier
  const submittedTier = (sheet.submittedTier ?? tier) as ClientTier
  const computation = computePricing(sheet, rates, tier)
  const submittedComputation = computePricing(sheet, rates, submittedTier)
  const tierTotals = {
    small: Math.round(computePricing(sheet, rates, 'small').total),
    medium: Math.round(computePricing(sheet, rates, 'medium').total),
    large: Math.round(computePricing(sheet, rates, 'large').total),
  }

  return {
    projectId: String(project._id),
    projectName: project.name,
    projectCode: project.code,
    clientId: String(project.clientId),
    clientName: client?.name || '—',
    clientTier: (client?.tier ?? 'small') as ClientTier,
    tier,
    submittedTier,
    isSubmitted: tier === submittedTier,
    tePct: sheet.tePct ?? 0.05,
    adminPct: sheet.adminPct ?? 0.05,
    waitingVendor: Boolean(sheet.waitingVendor),
    soldPrice: money(project.budget?.amount),
    computation,
    submittedComputation,
    tierTotals,
    ...sheetToInputDTO(sheet),
  }
}

/* ---- mutations ---- */

export const pricingSheetSchema = z.object({
  tier: z.enum(CLIENT_TIERS).optional(),
  /** Form sends whole percents (5), stored as a fraction (0.05). */
  tePct: z.coerce.number().min(0).max(100).optional(),
  adminPct: z.coerce.number().min(0).max(100).optional(),
  waitingVendor: z.coerce.boolean().optional().default(false),
  phases: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        workDays: z.coerce.number().min(0).max(2000).optional().default(0),
        resources: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              role: z.string().trim().min(1).max(80),
              serviceId: z.string().trim().optional().default(''),
              allocationPct: z.coerce.number().min(0).max(1000).optional().default(100),
            }),
          )
          .max(20)
          .optional()
          .default([]),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  thirdParty: z
    .array(
      z.object({
        vendorName: z.string().trim().max(80).optional().default(''),
        description: z.string().trim().min(1).max(200),
        cost: z.coerce.number().min(0), // AED
        markupPct: z.coerce.number().min(0).max(1000).optional().default(40), // whole percent
      }),
    )
    .max(20)
    .optional()
    .default([]),
})
export type PricingSheetInput = z.infer<typeof pricingSheetSchema>

async function loadProjectForSheet(projectId: string) {
  const project = await Project.findById(projectId)
  if (!project) throw new ServiceError('Project not found.', 404)
  return project
}

/** Blank sheet, tier defaulted from the client. */
export async function createPricingSheet(actor: CurrentUser, projectId: string) {
  await connectDB()
  const project = await loadProjectForSheet(projectId)
  if (project.pricing) return { id: String(project._id) }

  const client = await Client.findById(project.clientId).select('tier').lean()
  const tier = (client?.tier ?? 'small') as ClientTier

  project.pricing = {
    tier,
    submittedTier: tier,
    tePct: 0.05,
    adminPct: 0.05,
    phases: [],
    thirdParty: [],
    waitingVendor: false,
  }
  await project.save()
  await audit({ actorId: actor.id, action: 'project.pricing_started', targetType: 'Project', targetId: String(project._id) })
  return { id: String(project._id) }
}

export async function updatePricingSheet(actor: CurrentUser, projectId: string, input: PricingSheetInput) {
  await connectDB()
  const project = await loadProjectForSheet(projectId)
  const current = (project.pricing ?? null) as IPricingSheet | null

  project.pricing = {
    tier: input.tier ?? current?.tier ?? 'small',
    submittedTier: current?.submittedTier ?? input.tier ?? current?.tier ?? 'small',
    tePct: input.tePct !== undefined ? input.tePct / 100 : (current?.tePct ?? 0.05),
    adminPct: input.adminPct !== undefined ? input.adminPct / 100 : (current?.adminPct ?? 0.05),
    waitingVendor: input.waitingVendor,
    phases: input.phases.map((ph) => ({
      name: ph.name,
      workDays: ph.workDays,
      resources: ph.resources.map((r) => ({
        name: r.name,
        role: r.role,
        serviceId: r.serviceId ? new Types.ObjectId(r.serviceId) : null,
        allocationPct: r.allocationPct,
      })),
    })),
    thirdParty: input.thirdParty.map((t) => ({
      vendorName: t.vendorName || undefined,
      description: t.description,
      costToHs: Math.round(t.cost * 100),
      markupPct: t.markupPct / 100,
    })),
  }
  await project.save()
  await audit({ actorId: actor.id, action: 'project.pricing_updated', targetType: 'Project', targetId: String(project._id) })
  return { id: String(project._id) }
}

export async function setSheetTier(actor: CurrentUser, projectId: string, tier: ClientTier) {
  await connectDB()
  const project = await loadProjectForSheet(projectId)
  if (!project.pricing) throw new ServiceError('This project has no pricing sheet yet.', 400)
  project.pricing.tier = tier
  await project.save()
  await audit({ actorId: actor.id, action: 'project.pricing_tier', targetType: 'Project', targetId: String(project._id), metadata: { tier } })
  return { id: String(project._id) }
}

export async function setSubmittedTier(actor: CurrentUser, projectId: string, tier: ClientTier) {
  await connectDB()
  const project = await loadProjectForSheet(projectId)
  if (!project.pricing) throw new ServiceError('This project has no pricing sheet yet.', 400)
  project.pricing.submittedTier = tier
  project.pricing.tier = tier
  await project.save()
  await audit({ actorId: actor.id, action: 'project.pricing_submitted', targetType: 'Project', targetId: String(project._id), metadata: { tier } })
  return { id: String(project._id) }
}
