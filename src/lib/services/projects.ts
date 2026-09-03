import 'server-only'
import { z } from 'zod'
import { isValidObjectId, Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { audit } from '@/lib/audit'
import {
  Project,
  PROJECT_STATUSES,
  PROJECT_HEALTH,
  STAGE_STATES,
  RESOURCE_KINDS,
  type ProjectStatus,
  type ProjectHealth,
  type StageState,
  type ResourceKind,
} from '@/models/Project'
import { Client, type IContact } from '@/models/Client'
import { User } from '@/models/User'
import type { CurrentUser } from '@/lib/authz'
import { ServiceError } from './roles'
export { ServiceError } from './roles'

/* ----------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------- */

const resourceInput = z.object({
  label: z.string().trim().min(1, { message: 'Give the link a label.' }).max(60),
  url: z.string().trim().url({ message: 'Enter a valid URL.' }).max(500),
  kind: z.enum(RESOURCE_KINDS).optional().default('other'),
})

/** Core project fields — everything the "Edit project" modal owns. */
export const projectSchema = z.object({
  name: z.string().trim().min(1, { message: 'Project name is required.' }).max(200),
  clientId: z.string().trim().min(1, { message: 'Pick a client.' }),
  category: z.string().trim().max(80).optional().default('Creative'),
  status: z.enum(PROJECT_STATUSES).optional().default('active'),
  health: z.enum(PROJECT_HEALTH).optional().default('on_track'),
  daysBehind: z.coerce.number().int().min(0).max(3650).optional().default(0),
  revisionRounds: z.coerce.number().int().min(0).max(99).optional().default(0),
  plannedDuration: z.string().trim().max(60).optional().default(''),
  progressNote: z.string().trim().max(300).optional().default(''),
  startDate: z.string().trim().max(30).optional().default(''),
  dueDate: z.string().trim().max(30).optional().default(''),
  /** Final price sold, in AED major units. Stored as integer minor units. */
  value: z.coerce.number().min(0).max(1e12).optional().default(0),
  managerId: z.string().trim().optional().default(''),
  remarks: z.string().trim().max(500).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''),
  clientVisible: z.coerce.boolean().optional().default(false),
  resources: z.array(resourceInput).max(12).optional().default([]),
})
export type CreateProjectInput = z.infer<typeof projectSchema>

/** Every field optional — omitted keys are left untouched by updateProject. */
export const updateProjectSchema = projectSchema.partial()
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

/** The "Update tracker" modal — timeline, activity log and client checklist. */
export const trackerSchema = z.object({
  progressNote: z.string().trim().max(300).optional().default(''),
  delayNote: z.string().trim().max(400).optional().default(''),
  stages: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        note: z.string().trim().max(240).optional().default(''),
        owner: z.string().trim().max(60).optional().default('Human Saucer'),
        state: z.enum(STAGE_STATES).optional().default('upcoming'),
        targetDate: z.string().trim().max(30).optional().default(''),
        duration: z.string().trim().max(40).optional().default(''),
      }),
    )
    .max(30)
    .optional()
    .default([]),
  activity: z
    .array(
      z.object({
        occurredOn: z.string().trim().min(1).max(30),
        text: z.string().trim().min(1).max(300),
        pending: z.coerce.boolean().optional().default(false),
      }),
    )
    .max(50)
    .optional()
    .default([]),
  clientAsks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        note: z.string().trim().max(300).optional().default(''),
        dueOn: z.string().trim().max(30).optional().default(''),
        received: z.coerce.boolean().optional().default(false),
      }),
    )
    .max(30)
    .optional()
    .default([]),
})
export type TrackerInput = z.infer<typeof trackerSchema>

/* ----------------------------------------------------------------------------
 * DTOs — flat, primitive-only, ISO date strings. Safe across the RSC boundary.
 * ------------------------------------------------------------------------- */

export type ProjectListDTO = {
  id: string
  code: string
  name: string
  clientId: string
  clientName: string
  category: string
  status: ProjectStatus
  health: ProjectHealth
  daysBehind: number
  value: number
  percentComplete: number
}

export type ProjectContactDTO = { name: string; email: string; phone: string }
export type ProjectResourceDTO = { label: string; url: string; kind: ResourceKind }
export type ProjectStageDTO = {
  name: string
  note: string
  owner: string
  state: StageState
  targetDate: string | null
  duration: string
}
export type ProjectActivityDTO = { occurredOn: string; text: string; pending: boolean }
export type ProjectAskDTO = { title: string; note: string; dueOn: string | null; received: boolean }

export type ProjectDetailDTO = {
  id: string
  code: string
  name: string
  description: string
  clientId: string
  clientName: string
  industry: string
  country: string
  category: string
  status: ProjectStatus
  health: ProjectHealth
  daysBehind: number
  revisionRounds: number
  progressNote: string
  delayNote: string
  plannedDuration: string
  remarks: string
  value: number
  ownerName: string
  managerId: string
  startDate: string | null
  dueDate: string | null
  trackerUpdatedAt: string | null
  updatedAt: string
  clientVisible: boolean
  themeId: string
  stageCurrent: number
  stageTotal: number
  percentComplete: number
  clientContact: ProjectContactDTO | null
  resources: ProjectResourceDTO[]
  stages: ProjectStageDTO[]
  activity: ProjectActivityDTO[]
  clientAsks: ProjectAskDTO[]
  /** Suggested price from the pricing sheet — null until the rate card lands. */
  pricingSuggested: number | null
}

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Stage count and percent, derived from the timeline (hybrid progress model). */
export function computeProgress(stages: { state: StageState }[]): {
  stageCurrent: number
  stageTotal: number
  percentComplete: number
} {
  const stageTotal = stages.length
  let done = 0
  let activeIdx = -1
  stages.forEach((s, i) => {
    if (s.state === 'done') done++
    if (activeIdx < 0 && s.state === 'active') activeIdx = i
  })
  const stageCurrent = activeIdx >= 0 ? activeIdx + 1 : done
  const percentComplete = stageTotal
    ? Math.min(100, Math.max(0, Math.round(((done + (activeIdx >= 0 ? 0.5 : 0)) / stageTotal) * 100)))
    : 0
  return { stageCurrent, stageTotal, percentComplete }
}

/** The same primary-contact resolution the clients service uses. */
function resolveClientContact(client: {
  contacts?: IContact[]
  email?: string | null
  phone?: string | null
}): ProjectContactDTO | null {
  const c = client.contacts?.find((x) => x.isPrimary) ?? client.contacts?.[0] ?? null
  const name = c?.name || ''
  const email = c?.email || client.email || ''
  const phone = c?.phone || client.phone || ''
  if (!name && !email && !phone) return null
  return { name, email, phone }
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

async function uniqueProjectCode(name: string): Promise<string> {
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'PROJECT'
  const base = `PRJ-${slug}`
  let code = base
  let n = 1
  while (await Project.exists({ code })) {
    n += 1
    code = `${base}-${n}`
  }
  return code
}

/* ----------------------------------------------------------------------------
 * Queries
 * ------------------------------------------------------------------------- */

export async function listProjects(): Promise<ProjectListDTO[]> {
  await connectDB()

  const [projects, clients] = await Promise.all([
    Project.find().sort({ updatedAt: -1 }).lean(),
    Client.find().select('name').lean(),
  ])
  const nameById = new Map(clients.map((c) => [String(c._id), c.name]))

  return projects.map((p) => ({
    id: String(p._id),
    code: p.code,
    name: p.name,
    clientId: String(p.clientId),
    clientName: nameById.get(String(p.clientId)) || '—',
    category: p.tags?.[0] || 'General',
    status: p.status,
    health: p.health ?? 'on_track',
    daysBehind: p.daysBehind ?? 0,
    value: p.budget?.amount ? p.budget.amount / 100 : 0,
    percentComplete: computeProgress(p.stages ?? []).percentComplete,
  }))
}

export async function getProjectById(idOrCode: string): Promise<ProjectDetailDTO | null> {
  await connectDB()

  const project = isValidObjectId(idOrCode)
    ? await Project.findById(idOrCode).lean()
    : await Project.findOne({ code: idOrCode.toUpperCase() }).lean()
  if (!project) return null

  const [client, manager] = await Promise.all([
    Client.findById(project.clientId).select('name industry address email phone contacts').lean(),
    project.managerId ? User.findById(project.managerId).select('name').lean() : null,
  ])

  const progress = computeProgress(project.stages ?? [])

  return {
    id: String(project._id),
    code: project.code,
    name: project.name,
    description: project.description || '',
    clientId: String(project.clientId),
    clientName: client?.name || '—',
    industry: client?.industry || '—',
    country: client?.address?.country || 'UAE',
    category: project.tags?.[0] || 'General',
    status: project.status,
    health: project.health ?? 'on_track',
    daysBehind: project.daysBehind ?? 0,
    revisionRounds: project.revisionRounds ?? 0,
    progressNote: project.progressNote || '',
    delayNote: project.delayNote || '',
    plannedDuration: project.plannedDuration || '',
    remarks: project.remarks || '',
    value: project.budget?.amount ? project.budget.amount / 100 : 0,
    ownerName: manager?.name || '',
    managerId: project.managerId ? String(project.managerId) : '',
    startDate: project.startDate ? project.startDate.toISOString() : null,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    trackerUpdatedAt: project.trackerUpdatedAt ? project.trackerUpdatedAt.toISOString() : null,
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : new Date().toISOString(),
    clientVisible: Boolean(project.clientVisible),
    themeId: project.themeId || 'hs',
    stageCurrent: progress.stageCurrent,
    stageTotal: progress.stageTotal,
    percentComplete: progress.percentComplete,
    clientContact: client ? resolveClientContact(client) : null,
    resources: (project.resources ?? []).map((r) => ({ label: r.label, url: r.url, kind: r.kind })),
    stages: (project.stages ?? []).map((s) => ({
      name: s.name,
      note: s.note || '',
      owner: s.owner || 'Human Saucer',
      state: s.state,
      targetDate: s.targetDate ? s.targetDate.toISOString() : null,
      duration: s.duration || '',
    })),
    activity: (project.activity ?? []).map((a) => ({
      occurredOn: a.occurredOn ? a.occurredOn.toISOString() : new Date().toISOString(),
      text: a.text,
      pending: Boolean(a.pending),
    })),
    clientAsks: (project.clientAsks ?? []).map((k) => ({
      title: k.title,
      note: k.note || '',
      dueOn: k.dueOn ? k.dueOn.toISOString() : null,
      received: Boolean(k.received),
    })),
    pricingSuggested: null,
  }
}

/** Users for the owner picker in the project modal. */
export async function listTeamOptions(): Promise<{ id: string; name: string }[]> {
  await connectDB()
  const users = await User.find({ status: 'active' }).select('name').sort({ name: 1 }).lean()
  return users.map((u) => ({ id: String(u._id), name: u.name }))
}

/* ----------------------------------------------------------------------------
 * Mutations
 * ------------------------------------------------------------------------- */

export async function createProject(actor: CurrentUser, input: CreateProjectInput) {
  await connectDB()

  const client = await Client.findById(input.clientId).lean()
  if (!client) throw new ServiceError('Pick a client from the list.', 400, 'clientId')

  const code = await uniqueProjectCode(input.name)

  const project = await Project.create({
    code,
    name: input.name,
    description: input.description || undefined,
    clientId: client._id,
    status: input.status,
    health: input.health,
    daysBehind: input.daysBehind,
    revisionRounds: input.revisionRounds,
    plannedDuration: input.plannedDuration || undefined,
    progressNote: input.progressNote || undefined,
    startDate: toDate(input.startDate),
    dueDate: toDate(input.dueDate),
    managerId: input.managerId || null,
    budget: { amount: Math.round((input.value || 0) * 100), currency: 'AED' },
    tags: input.category ? [input.category] : [],
    remarks: input.remarks || undefined,
    resources: input.resources,
    clientVisible: input.clientVisible,
    createdBy: actor.id,
  })

  await audit({
    actorId: actor.id,
    action: 'project.created',
    targetType: 'Project',
    targetId: String(project._id),
    metadata: { name: project.name, code: project.code },
  })

  return { id: String(project._id), name: project.name }
}

export async function updateProject(actor: CurrentUser, projectId: string, input: UpdateProjectInput) {
  await connectDB()

  const project = await Project.findById(projectId)
  if (!project) throw new ServiceError('Project not found.', 404)

  if (input.clientId !== undefined) {
    const client = await Client.findById(input.clientId).lean()
    if (!client) throw new ServiceError('Pick a client from the list.', 400, 'clientId')
    project.clientId = client._id
  }
  if (input.name !== undefined) project.name = input.name
  if (input.description !== undefined) project.description = input.description || undefined
  if (input.status !== undefined) project.status = input.status
  if (input.health !== undefined) project.health = input.health
  if (input.daysBehind !== undefined) project.daysBehind = input.daysBehind
  if (input.revisionRounds !== undefined) project.revisionRounds = input.revisionRounds
  if (input.plannedDuration !== undefined) project.plannedDuration = input.plannedDuration || undefined
  if (input.progressNote !== undefined) project.progressNote = input.progressNote || undefined
  if (input.startDate !== undefined) project.startDate = toDate(input.startDate)
  if (input.dueDate !== undefined) project.dueDate = toDate(input.dueDate)
  if (input.managerId !== undefined) {
    project.managerId = input.managerId ? new Types.ObjectId(input.managerId) : null
  }
  if (input.value !== undefined) {
    project.budget = { amount: Math.round(input.value * 100), currency: project.budget?.currency || 'AED' }
  }
  if (input.category !== undefined) project.tags = input.category ? [input.category] : []
  if (input.remarks !== undefined) project.remarks = input.remarks || undefined
  if (input.resources !== undefined) project.resources = input.resources
  if (input.clientVisible !== undefined) project.clientVisible = input.clientVisible

  await project.save()

  await audit({
    actorId: actor.id,
    action: 'project.updated',
    targetType: 'Project',
    targetId: String(project._id),
    metadata: { name: project.name },
  })

  return { id: String(project._id), name: project.name }
}

export async function updateTracker(actor: CurrentUser, projectId: string, input: TrackerInput) {
  await connectDB()

  const project = await Project.findById(projectId)
  if (!project) throw new ServiceError('Project not found.', 404)

  project.stages = input.stages.map((s) => ({
    name: s.name,
    note: s.note || undefined,
    owner: s.owner || 'Human Saucer',
    state: s.state,
    targetDate: toDate(s.targetDate),
    duration: s.duration || undefined,
  }))
  project.activity = input.activity.map((a) => ({
    occurredOn: toDate(a.occurredOn) ?? new Date(),
    text: a.text,
    pending: a.pending,
  }))
  project.clientAsks = input.clientAsks.map((k) => ({
    title: k.title,
    note: k.note || undefined,
    dueOn: toDate(k.dueOn),
    received: k.received,
  }))
  project.progressNote = input.progressNote || undefined
  project.delayNote = input.delayNote || undefined
  project.progressPct = computeProgress(project.stages).percentComplete
  project.trackerUpdatedAt = new Date()

  await project.save()

  await audit({
    actorId: actor.id,
    action: 'project.tracker_updated',
    targetType: 'Project',
    targetId: String(project._id),
    metadata: { name: project.name, stages: project.stages.length },
  })

  return { id: String(project._id), name: project.name }
}

export async function deleteProject(actor: CurrentUser, projectId: string) {
  await connectDB()

  const project = await Project.findById(projectId)
  if (!project) throw new ServiceError('Project not found.', 404)

  await project.deleteOne()

  await audit({
    actorId: actor.id,
    action: 'project.deleted',
    targetType: 'Project',
    targetId: projectId,
    metadata: { name: project.name },
  })
}
