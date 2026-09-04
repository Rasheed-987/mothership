import { Schema, model, models, type Model, type Types } from 'mongoose'
import { MoneySchema, CLIENT_TIERS, type IMoney, type ClientTier } from './shared'

// Re-exported for back-compat: tiers used to live here.
export { CLIENT_TIERS, type ClientTier } from './shared'

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export const BILLING_TYPES = ['fixed', 'hourly', 'retainer', 'non_billable'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

/** Delivery health — the client-facing "on schedule / behind" signal, separate from the lifecycle `status`. */
export const PROJECT_HEALTH = ['on_track', 'behind'] as const
export type ProjectHealth = (typeof PROJECT_HEALTH)[number]

/** Timeline stage state. `active` is the demo's `now`. */
export const STAGE_STATES = ['done', 'active', 'upcoming'] as const
export type StageState = (typeof STAGE_STATES)[number]

export const RESOURCE_KINDS = ['drive', 'figma', 'proposal', 'other'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export interface IPricingResource {
  name: string
  /** Cached label. `serviceId` is the real link to the rate-card row. */
  role: string
  serviceId?: Types.ObjectId | null
  allocationPct: number
}

export interface IPricingPhase {
  name: string
  workDays: number
  resources: IPricingResource[]
}

export interface IThirdPartyCost {
  vendorName?: string
  description: string
  costToHs: number // Value in smallest currency unit (cents/paisa)
  markupPct: number // e.g. 0.40 for 40%
}

export interface IPricingSheet {
  /** The effective tier this sheet is priced at. Defaults from the client, editable. */
  tier: ClientTier
  /** The tier actually quoted to the client (may differ from `tier` while exploring). */
  submittedTier?: ClientTier
  tePct: number    // Travel & Expenses % (default 0.05 / 5%)
  adminPct: number // Admin fee % (default 0.05 / 5%)
  phases: IPricingPhase[]
  thirdParty: IThirdPartyCost[]
  /** Vendor prices still outstanding — shown on the sheet. */
  waitingVendor?: boolean
}

/** One row of the client-facing "The plan" timeline. */
export interface IProjectStage {
  name: string
  note?: string
  owner: string
  state: StageState
  targetDate?: Date | null
  duration?: string // "3 weeks" — shown instead of a date on upcoming rows
}

/** One line of the "Recent activity" log. */
export interface IActivityEntry {
  occurredOn: Date
  text: string
  pending: boolean
}

/** One item of "What we need from you". */
export interface IClientAsk {
  title: string
  note?: string
  dueOn?: Date | null
  received: boolean
}

/** A link in the "Resources" card. */
export interface IResourceLink {
  label: string
  url: string
  kind: ResourceKind
}

export interface IProject {
  _id: Types.ObjectId
  code: string
  name: string
  description?: string
  clientId: Types.ObjectId
  /** Where it came from, when it came from the pipeline. */
  dealId?: Types.ObjectId | null
  status: ProjectStatus
  priority: ProjectPriority
  startDate?: Date | null
  dueDate?: Date | null
  completedAt?: Date | null
  /**
   * The PM. Flat `managerId` + `memberIds` reflects the org-wide-roles
   * decision. If per-project roles are ever needed, this pair becomes
   * `members: [{ userId, projectRoleId }]` — that migration starts here.
   */
  managerId?: Types.ObjectId | null
  memberIds: Types.ObjectId[]
  budget: IMoney
  billingType: BillingType
  progressPct: number
  tags: string[]
  pricing?: IPricingSheet | null

  // --- Client-facing project page ---
  /** Delivery signal shown to the client; the lifecycle lives in `status`. */
  health: ProjectHealth
  daysBehind: number
  progressNote?: string
  revisionRounds: number
  /** The quoted figure ("12 weeks") — free text, not a computed span. */
  plannedDuration?: string
  delayNote?: string
  /** Manually stamped when the tracker is saved — `updatedAt` moves on every edit. */
  trackerUpdatedAt?: Date | null
  remarks?: string
  stages: IProjectStage[]
  activity: IActivityEntry[]
  clientAsks: IClientAsk[]
  resources: IResourceLink[]
  /** Portal groundwork — the public /p/[shareId] route is a later phase. */
  clientVisible: boolean
  shareId?: string
  themeId: string

  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const PricingResourceSchema = new Schema<IPricingResource>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    allocationPct: { type: Number, required: true, default: 100, min: 0, max: 1000 },
  },
  { _id: false },
)

const PricingPhaseSchema = new Schema<IPricingPhase>(
  {
    name: { type: String, required: true, trim: true },
    workDays: { type: Number, required: true, default: 0, min: 0 },
    resources: { type: [PricingResourceSchema], default: [] },
  },
  { _id: false },
)

const ThirdPartyCostSchema = new Schema<IThirdPartyCost>(
  {
    vendorName: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    costToHs: { type: Number, required: true, min: 0 },
    markupPct: { type: Number, required: true, default: 0.4, min: 0, max: 10 },
  },
  { _id: false },
)

const PricingSheetSchema = new Schema<IPricingSheet>(
  {
    tier: { type: String, enum: CLIENT_TIERS, required: true, default: 'small' },
    submittedTier: { type: String, enum: CLIENT_TIERS, default: null },
    tePct: { type: Number, required: true, default: 0.05, min: 0, max: 1 },
    adminPct: { type: Number, required: true, default: 0.05, min: 0, max: 1 },
    phases: { type: [PricingPhaseSchema], default: [] },
    thirdParty: { type: [ThirdPartyCostSchema], default: [] },
    waitingVendor: { type: Boolean, default: false },
  },
  { _id: false },
)

const ProjectStageSchema = new Schema<IProjectStage>(
  {
    name: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    owner: { type: String, required: true, trim: true, default: 'Human Saucer' },
    state: { type: String, enum: STAGE_STATES, required: true, default: 'upcoming' },
    targetDate: { type: Date, default: null },
    duration: { type: String, trim: true },
  },
  { _id: false },
)

const ActivityEntrySchema = new Schema<IActivityEntry>(
  {
    occurredOn: { type: Date, required: true },
    text: { type: String, required: true, trim: true },
    pending: { type: Boolean, required: true, default: false },
  },
  { _id: false },
)

const ClientAskSchema = new Schema<IClientAsk>(
  {
    title: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    dueOn: { type: Date, default: null },
    received: { type: Boolean, required: true, default: false },
  },
  { _id: false },
)

const ResourceLinkSchema = new Schema<IResourceLink>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    kind: { type: String, enum: RESOURCE_KINDS, required: true, default: 'other' },
  },
  { _id: false },
)

const ProjectSchema = new Schema<IProject>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', default: null },
    status: { type: String, enum: PROJECT_STATUSES, required: true, default: 'planning' },
    priority: { type: String, enum: PROJECT_PRIORITIES, required: true, default: 'normal' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    budget: { type: MoneySchema, required: true },
    billingType: { type: String, enum: BILLING_TYPES, required: true, default: 'fixed' },
    progressPct: { type: Number, required: true, default: 0, min: 0, max: 100 },
    tags: { type: [String], default: [] },
    pricing: { type: PricingSheetSchema, default: null },

    health: { type: String, enum: PROJECT_HEALTH, required: true, default: 'on_track' },
    daysBehind: { type: Number, required: true, default: 0, min: 0 },
    progressNote: { type: String, trim: true },
    revisionRounds: { type: Number, required: true, default: 0, min: 0 },
    plannedDuration: { type: String, trim: true },
    delayNote: { type: String, trim: true },
    trackerUpdatedAt: { type: Date, default: null },
    remarks: { type: String, trim: true },
    stages: { type: [ProjectStageSchema], default: [] },
    activity: { type: [ActivityEntrySchema], default: [] },
    clientAsks: { type: [ClientAskSchema], default: [] },
    resources: { type: [ResourceLinkSchema], default: [] },
    clientVisible: { type: Boolean, required: true, default: false },
    shareId: { type: String, trim: true },
    themeId: { type: String, required: true, default: 'hs', trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

// Keep completedAt honest so "Completed projects" is a pure status filter and
// never needs a separate collection.
ProjectSchema.pre('save', async function () {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date()
      this.progressPct = 100
    }
    if (this.status !== 'completed') this.completedAt = null
  }
})

ProjectSchema.index({ status: 1, updatedAt: -1 })
ProjectSchema.index({ clientId: 1, status: 1 })
ProjectSchema.index({ managerId: 1 })
ProjectSchema.index({ memberIds: 1 })
ProjectSchema.index({ shareId: 1 }, { unique: true, sparse: true })

export const Project: Model<IProject> = (models.Project as Model<IProject>) ?? model<IProject>('Project', ProjectSchema)
