import { Schema, model, models, type Model, type Types } from 'mongoose'
import { MoneySchema, type IMoney } from './shared'

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const CLOSED_STAGES: DealStage[] = ['won', 'lost']

export interface IStageChange {
  stage: DealStage
  enteredAt: Date
  byUserId?: Types.ObjectId | null
}

export interface IDeal {
  _id: Types.ObjectId
  title: string
  clientId: Types.ObjectId
  stage: DealStage
  value: IMoney
  probability: number
  expectedCloseDate?: Date | null
  ownerId?: Types.ObjectId | null
  source?: string
  lostReason?: string | null
  /**
   * Append-only. Without it you cannot answer "how long do deals sit in
   * negotiation?" — and it is impossible to backfill after the fact.
   */
  stageHistory: IStageChange[]
  convertedProjectId?: Types.ObjectId | null
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const StageChangeSchema = new Schema<IStageChange>(
  {
    stage: { type: String, enum: DEAL_STAGES, required: true },
    enteredAt: { type: Date, required: true, default: Date.now },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
)

const DealSchema = new Schema<IDeal>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    stage: { type: String, enum: DEAL_STAGES, required: true, default: 'lead' },
    value: { type: MoneySchema, required: true },
    probability: { type: Number, required: true, default: 0, min: 0, max: 100 },
    expectedCloseDate: { type: Date, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, trim: true },
    lostReason: { type: String, default: null },
    stageHistory: { type: [StageChangeSchema], default: [] },
    convertedProjectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

// Seed the history with the opening stage so the timeline has no gap at the start.
DealSchema.pre('save', async function () {
  if (this.isNew && this.stageHistory.length === 0) {
    this.stageHistory.push({ stage: this.stage, enteredAt: new Date(), byUserId: this.ownerId ?? null })
  }
})

DealSchema.index({ stage: 1, updatedAt: -1 })
DealSchema.index({ clientId: 1 })
DealSchema.index({ ownerId: 1, stage: 1 })

export const Deal: Model<IDeal> = (models.Deal as Model<IDeal>) ?? model<IDeal>('Deal', DealSchema)
