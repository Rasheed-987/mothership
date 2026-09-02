import { Schema, model, models, type Model, type Types } from 'mongoose'

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

export interface IInvitation {
  _id: Types.ObjectId
  email: string
  roleId: Types.ObjectId
  /** sha256 of the token in the link. Treated exactly like a password. */
  tokenHash: string
  invitedBy: Types.ObjectId
  status: InvitationStatus
  expiresAt: Date
  acceptedAt?: Date | null
  acceptedBy?: Types.ObjectId | null
  createdAt: Date
}

const InvitationSchema = new Schema<IInvitation>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: INVITATION_STATUSES, required: true, default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// One live invite per address — re-inviting revokes the old one first.
InvitationSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_invite_per_email' },
)
// Deliberately NO TTL index here: a lapsed invite should show as `expired` in
// the admin list, not silently vanish.
InvitationSchema.index({ status: 1, expiresAt: 1 })

export const Invitation: Model<IInvitation> =
  (models.Invitation as Model<IInvitation>) ?? model<IInvitation>('Invitation', InvitationSchema)
