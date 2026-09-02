import { Schema, model, models, type Model, type Types } from 'mongoose'
import { MoneySchema, type IMoney } from './shared'

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export const BILLING_TYPES = ['fixed', 'hourly', 'retainer', 'non_billable'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

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
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

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

export const Project: Model<IProject> = (models.Project as Model<IProject>) ?? model<IProject>('Project', ProjectSchema)
