import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface ISession {
  _id: Types.ObjectId
  userId: Types.ObjectId
  /**
   * sha256 of the random token held in the cookie. The raw token is never
   * stored, so a database leak does not hand over live sessions.
   */
  tokenHash: string
  expiresAt: Date
  lastUsedAt: Date
  ip?: string | null
  userAgent?: string | null
  createdAt: Date
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true, default: Date.now },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// TTL index: Mongo reaps expired sessions itself, no cron needed.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// "Log out everywhere" and cascade-on-password-change.
SessionSchema.index({ userId: 1 })

export const Session: Model<ISession> = (models.Session as Model<ISession>) ?? model<ISession>('Session', SessionSchema)
