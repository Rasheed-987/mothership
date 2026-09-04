import { Schema, model, models, type Model, type Types } from 'mongoose'
import { CLIENT_TIERS, type ClientTier } from './shared'

export const CLIENT_STATUSES = ['lead', 'active', 'inactive', 'archived'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export interface IContact {
  name: string
  email?: string
  phone?: string
  jobTitle?: string
  isPrimary: boolean
}

export interface IClient {
  _id: Types.ObjectId
  name: string
  legalName?: string
  email?: string
  phone?: string
  website?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }
  industry?: string
  status: ClientStatus
  /** Business size — the default tier for every pricing sheet on this client's projects. */
  tier: ClientTier
  /** Account manager. */
  ownerId?: Types.ObjectId | null
  /** Embedded: small, bounded, and never queried independently of the client. */
  contacts: IContact[]
  tags: string[]
  notes?: string
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
)

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    legalName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    industry: { type: String, trim: true },
    status: { type: String, enum: CLIENT_STATUSES, required: true, default: 'lead' },
    tier: { type: String, enum: CLIENT_TIERS, required: true, default: 'small' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    contacts: { type: [ContactSchema], default: [] },
    tags: { type: [String], default: [] },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

ClientSchema.index({ name: 1 })
ClientSchema.index({ status: 1, updatedAt: -1 })
ClientSchema.index({ ownerId: 1 })

export const Client: Model<IClient> = (models.Client as Model<IClient>) ?? model<IClient>('Client', ClientSchema)
