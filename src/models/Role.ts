import { Schema, model, models, type Model, type Types } from 'mongoose'
import { ALL_PERMISSIONS, type Permission } from '@/lib/permissions'

export interface IRole {
  _id: Types.ObjectId
  key: string
  name: string
  description?: string
  isSystem: boolean
  permissions: Permission[]
  createdBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const RoleSchema = new Schema<IRole>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z][a-z0-9_]*$/, 'Role key must be snake_case'],
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
    // System roles are seeded and cannot be renamed or deleted from the UI.
    isSystem: { type: Boolean, required: true, default: false },
    permissions: {
      type: [{ type: String, enum: ALL_PERMISSIONS }],
      required: true,
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export const Role: Model<IRole> = (models.Role as Model<IRole>) ?? model<IRole>('Role', RoleSchema)
