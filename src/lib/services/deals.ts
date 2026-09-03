import 'server-only'
import { z } from 'zod'
import { isValidObjectId, Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { audit } from '@/lib/audit'
import {
  Deal,
  DEAL_STAGES,
  DEAL_CONFIDENCE,
  type IDeal,
  type DealStage,
  type DealConfidence,
} from '@/models/Deal'
import { Client } from '@/models/Client'
import { User } from '@/models/User'
import type { CurrentUser } from '@/lib/authz'
import { suggestProbability, pipeStatusLabel, DEAL_STAGE_LABELS } from '@/lib/deal-constants'
import { ServiceError } from './roles'
export { ServiceError } from './roles'

/* ----------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

export const dealSchema = z.object({
  title: z.string().trim().min(1, { message: 'Give the opportunity a name.' }).max(200),
  clientId: z.string().trim().min(1, { message: 'Pick a client.' }),
  category: z.string().trim().max(80).optional().default('Creative'),
  stage: z.enum(DEAL_STAGES).optional().default('lead'),
  confidence: z.enum(DEAL_CONFIDENCE).optional().default('high'),
  /** Deal value in AED major units. Stored as integer minor units. */
  value: z.coerce.number().min(0).max(1e12).optional().default(0),
  /** 0–100. Omit to accept the stage/confidence suggestion. */
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().trim().max(30).optional().default(''),
  nextFollowUpDate: z.string().trim().max(30).optional().default(''),
  ownerId: z.string().trim().optional().default(''),
  source: z.string().trim().max(300).optional().default(''),
})
export type CreateDealInput = z.infer<typeof dealSchema>

export const updateDealSchema = dealSchema.partial()
export type UpdateDealInput = z.infer<typeof updateDealSchema>

export const noteSchema = z.object({
  text: z.string().trim().min(1, { message: 'Write something first.' }).max(1000),
})
export type NoteInput = z.infer<typeof noteSchema>

/* ----------------------------------------------------------------------------
 * DTOs
 * ------------------------------------------------------------------------- */

export type DealNoteDTO = { text: string; at: string; by: string }

export type DealDTO = {
  id: string
  title: string
  clientId: string
  clientName: string
  industry: string
  country: string
  category: string
  stage: DealStage
  stageLabel: string
  statusLabel: string
  confidence: DealConfidence
  value: number
  probability: number
  adjustedValue: number
  ownerName: string
  ownerId: string
  source: string
  expectedCloseDate: string | null
  nextFollowUpDate: string | null
  overdueDays: number | null
  lastUpdate: string | null
  createdAt: string
  convertedProjectId: string | null
  notes: DealNoteDTO[]
}

export type PipelineBucket = { key: string; label: string; total: number; adjusted: number }
export type PipelineDTO = {
  followUps: DealDTO[]
  rest: DealDTO[]
  totals: { total: number; adjusted: number; buckets: PipelineBucket[] }
}

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const DAY = 86_400_000

export function computeAdjusted(value: number, probability: number): number {
  return Math.round((value * probability) / 100)
}

/** Whole days a follow-up is past due, or null if not set / not yet due. */
export function overdueDays(next?: Date | string | null): number | null {
  if (!next) return null
  const d = next instanceof Date ? next : new Date(next)
  if (isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / DAY)
  return days >= 1 ? days : null
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

type ClientLite = { name?: string; industry?: string; address?: { country?: string } | null }

function toDTO(
  d: IDeal,
  client: ClientLite | null,
  ownerName: string,
  userNames: Map<string, string>,
): DealDTO {
  const value = d.value?.amount ? d.value.amount / 100 : 0
  const probability = d.probability ?? 0
  const next = d.nextFollowUpDate ?? null
  const lastContacted = d.lastContactedAt ?? null

  return {
    id: String(d._id),
    title: d.title ?? '',
    clientId: String(d.clientId),
    clientName: client?.name || '—',
    industry: client?.industry || '—',
    country: client?.address?.country || 'UAE',
    category: d.tags?.[0] || 'General',
    stage: d.stage,
    stageLabel: DEAL_STAGE_LABELS[d.stage] ?? d.stage,
    statusLabel: pipeStatusLabel(d.stage, d.confidence),
    confidence: d.confidence,
    value,
    probability,
    adjustedValue: computeAdjusted(value, probability),
    ownerName,
    ownerId: d.ownerId ? String(d.ownerId) : '',
    source: d.source ?? '',
    expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate).toISOString() : null,
    nextFollowUpDate: next ? new Date(next).toISOString() : null,
    overdueDays: overdueDays(next),
    lastUpdate: (lastContacted ?? d.updatedAt) ? new Date(lastContacted ?? d.updatedAt).toISOString() : null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
    convertedProjectId: d.convertedProjectId ? String(d.convertedProjectId) : null,
    notes: (d.notes ?? []).map((n) => ({
      text: n.text,
      at: n.at ? new Date(n.at).toISOString() : new Date().toISOString(),
      by: n.byUserId ? userNames.get(String(n.byUserId)) || '' : '',
    })),
  }
}

async function resolveRefs(deals: IDeal[]) {
  const clientIds = [...new Set(deals.map((d) => String(d.clientId)))]
  const userIds = [
    ...new Set([
      ...deals.map((d) => (d.ownerId ? String(d.ownerId) : null)),
      ...deals.flatMap((d) => (d.notes ?? []).map((n) => (n.byUserId ? String(n.byUserId) : null))),
    ].filter((x): x is string => Boolean(x))),
  ]

  const [clients, users] = await Promise.all([
    Client.find({ _id: { $in: clientIds } }).select('name industry address').lean(),
    userIds.length ? User.find({ _id: { $in: userIds } }).select('name').lean() : Promise.resolve([]),
  ])

  return {
    clientById: new Map(clients.map((c) => [String(c._id), c])),
    userNames: new Map(users.map((u) => [String(u._id), u.name])),
  }
}

/* ----------------------------------------------------------------------------
 * Queries
 * ------------------------------------------------------------------------- */

function dealRank(d: DealDTO): number {
  if (d.stage === 'proposal') return d.confidence === 'high' ? 0 : 1
  return 2
}

export async function getPipeline(): Promise<PipelineDTO> {
  await connectDB()

  const deals = (await Deal.find({ stage: { $nin: ['won', 'lost'] } }).lean()) as unknown as IDeal[]
  const { clientById, userNames } = await resolveRefs(deals)

  const dtos = deals.map((d) =>
    toDTO(
      d,
      clientById.get(String(d.clientId)) ?? null,
      d.ownerId ? userNames.get(String(d.ownerId)) || '' : '',
      userNames,
    ),
  )

  const followUps = dtos
    .filter((d) => d.overdueDays != null)
    .sort((a, b) => (a.nextFollowUpDate ?? '').localeCompare(b.nextFollowUpDate ?? ''))
  const rest = dtos
    .filter((d) => d.overdueDays == null)
    .sort((a, b) => dealRank(a) - dealRank(b) || b.value - a.value)

  const bucketOf = (d: DealDTO) =>
    d.stage === 'proposal' ? (d.confidence === 'high' ? 'proposal_high' : 'proposal_low') : 'discussions'
  const bucketDefs: PipelineBucket[] = [
    { key: 'proposal_high', label: 'Proposal · high', total: 0, adjusted: 0 },
    { key: 'proposal_low', label: 'Proposal · low', total: 0, adjusted: 0 },
    { key: 'discussions', label: 'Discussions', total: 0, adjusted: 0 },
  ]
  let total = 0
  let adjusted = 0
  for (const d of dtos) {
    total += d.value
    adjusted += d.adjustedValue
    const b = bucketDefs.find((x) => x.key === bucketOf(d))!
    b.total += d.value
    b.adjusted += d.adjustedValue
  }

  return { followUps, rest, totals: { total, adjusted, buckets: bucketDefs } }
}

export async function listDeals(): Promise<DealDTO[]> {
  await connectDB()
  const deals = (await Deal.find().sort({ updatedAt: -1 }).lean()) as unknown as IDeal[]
  const { clientById, userNames } = await resolveRefs(deals)
  return deals.map((d) =>
    toDTO(
      d,
      clientById.get(String(d.clientId)) ?? null,
      d.ownerId ? userNames.get(String(d.ownerId)) || '' : '',
      userNames,
    ),
  )
}

export async function getDealById(idOrTitle: string): Promise<DealDTO | null> {
  await connectDB()
  const found = isValidObjectId(idOrTitle)
    ? await Deal.findById(idOrTitle).lean()
    : await Deal.findOne({ title: idOrTitle }).lean()
  if (!found) return null
  const deal = found as unknown as IDeal
  const { clientById, userNames } = await resolveRefs([deal])
  return toDTO(
    deal,
    clientById.get(String(deal.clientId)) ?? null,
    deal.ownerId ? userNames.get(String(deal.ownerId)) || '' : '',
    userNames,
  )
}

/* ----------------------------------------------------------------------------
 * Mutations
 * ------------------------------------------------------------------------- */

export async function createDeal(actor: CurrentUser, input: CreateDealInput) {
  await connectDB()

  const client = await Client.findById(input.clientId).lean()
  if (!client) throw new ServiceError('Pick a client from the list.', 400, 'clientId')

  const probability = input.probability ?? suggestProbability(input.stage, input.confidence)
  const now = new Date()

  const deal = await Deal.create({
    title: input.title,
    clientId: client._id,
    stage: input.stage,
    confidence: input.confidence,
    value: { amount: Math.round((input.value || 0) * 100), currency: 'AED' },
    probability,
    expectedCloseDate: toDate(input.expectedCloseDate),
    nextFollowUpDate: toDate(input.nextFollowUpDate),
    lastContactedAt: now,
    ownerId: input.ownerId || null,
    source: input.source || undefined,
    tags: input.category ? [input.category] : [],
    createdBy: actor.id,
  })

  await audit({
    actorId: actor.id,
    action: 'deal.created',
    targetType: 'Deal',
    targetId: String(deal._id),
    metadata: { title: deal.title, stage: deal.stage },
  })

  return { id: String(deal._id), title: deal.title }
}

export async function updateDeal(actor: CurrentUser, dealId: string, input: UpdateDealInput) {
  await connectDB()

  const deal = await Deal.findById(dealId)
  if (!deal) throw new ServiceError('Deal not found.', 404)

  if (input.clientId !== undefined) {
    const client = await Client.findById(input.clientId).lean()
    if (!client) throw new ServiceError('Pick a client from the list.', 400, 'clientId')
    deal.clientId = client._id
  }
  if (input.title !== undefined) deal.title = input.title
  if (input.stage !== undefined) deal.stage = input.stage as DealStage
  if (input.confidence !== undefined) deal.confidence = input.confidence as DealConfidence
  if (input.value !== undefined) {
    deal.value = { amount: Math.round(input.value * 100), currency: deal.value?.currency || 'AED' }
  }
  if (input.probability !== undefined) deal.probability = input.probability
  if (input.expectedCloseDate !== undefined) deal.expectedCloseDate = toDate(input.expectedCloseDate)
  if (input.nextFollowUpDate !== undefined) deal.nextFollowUpDate = toDate(input.nextFollowUpDate)
  if (input.ownerId !== undefined) deal.ownerId = input.ownerId ? new Types.ObjectId(input.ownerId) : null
  if (input.source !== undefined) deal.source = input.source || undefined
  if (input.category !== undefined) deal.tags = input.category ? [input.category] : []

  await deal.save()

  await audit({
    actorId: actor.id,
    action: 'deal.updated',
    targetType: 'Deal',
    targetId: String(deal._id),
    metadata: { title: deal.title },
  })

  return { id: String(deal._id), title: deal.title }
}

export async function addDealNote(actor: CurrentUser, dealId: string, input: NoteInput) {
  await connectDB()

  const deal = await Deal.findById(dealId)
  if (!deal) throw new ServiceError('Deal not found.', 404)

  const now = new Date()
  deal.notes.push({ text: input.text, at: now, byUserId: new Types.ObjectId(actor.id) })
  deal.lastContactedAt = now
  await deal.save()

  await audit({
    actorId: actor.id,
    action: 'deal.note_added',
    targetType: 'Deal',
    targetId: String(deal._id),
    metadata: { title: deal.title },
  })

  return { id: String(deal._id), title: deal.title }
}

export async function deleteDeal(actor: CurrentUser, dealId: string) {
  await connectDB()

  const deal = await Deal.findById(dealId)
  if (!deal) throw new ServiceError('Deal not found.', 404)

  await deal.deleteOne()

  await audit({
    actorId: actor.id,
    action: 'deal.deleted',
    targetType: 'Deal',
    targetId: dealId,
    metadata: { title: deal.title },
  })
}
