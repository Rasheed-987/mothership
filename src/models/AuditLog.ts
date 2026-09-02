import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface IAuditLog {
  _id: Types.ObjectId
  actorId?: Types.ObjectId | null
  /** Dotted verb, e.g. `invitation.created`, `expense.approved`. */
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
  ip?: string | null
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ actorId: 1, createdAt: -1 })
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) ?? model<IAuditLog>('AuditLog', AuditLogSchema)
