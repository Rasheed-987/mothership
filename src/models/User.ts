import { Schema, model, models, type Model, type Types } from 'mongoose'

export const USER_STATUSES = ['active', 'suspended', 'deactivated'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export interface IRoleAssignment {
  roleId: Types.ObjectId
  assignedBy?: Types.ObjectId
  assignedAt: Date
}

export interface IUser {
  _id: Types.ObjectId
  email: string
  emailVerifiedAt?: Date | null
  name: string
  passwordHash: string
  avatarUrl?: string | null
  status: UserStatus
  /**
   * The owner. Deliberately a flag and not a row in `roles`: if it were a role,
   * anyone with `role.update` could edit the owner's permissions and lock the
   * real owner out. A partial unique index keeps exactly one.
   */
  isSuperAdmin: boolean
  /** Embedded rather than a join collection — small, bounded, always read with the user. */
  roles: IRoleAssignment[]
  createdAt: Date
  updatedAt: Date
}

const RoleAssignmentSchema = new Schema<IRoleAssignment>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
)

const UserSchema = new Schema<IUser>(
  {
    // Mongo has no citext. Lowercasing on write keeps uniqueness honest without
    // needing a case-insensitive collation on the index.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerifiedAt: { type: Date, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Never returned unless explicitly selected — see findByEmailWithHash().
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active' },
    isSuperAdmin: { type: Boolean, required: true, default: false },
    roles: { type: [RoleAssignmentSchema], required: true, default: [] },
  },
  { timestamps: true },
)

// Exactly one super admin, enforced by the database rather than by hoping.
UserSchema.index(
  { isSuperAdmin: 1 },
  { unique: true, partialFilterExpression: { isSuperAdmin: true }, name: 'one_super_admin' },
)
// "Who holds this role?" — needed before deleting a role.
UserSchema.index({ 'roles.roleId': 1 })
UserSchema.index({ status: 1 })

export const User: Model<IUser> = (models.User as Model<IUser>) ?? model<IUser>('User', UserSchema)
