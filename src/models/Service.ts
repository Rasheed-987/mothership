import { Schema, model, models, type Model, type Types } from 'mongoose'
import { MoneySchema, type IMoney } from './shared'

export const PRICING_MODELS = ['fixed', 'hourly', 'daily', 'monthly', 'retainer'] as const
export type PricingModel = (typeof PRICING_MODELS)[number]

export interface IServiceTierRate {
  tier: 'small' | 'medium' | 'large'
  hourlyRate: IMoney
  dayRate: IMoney
}

/**
 * The rate card behind the "Pricing" screen — what you sell and for how much.
 * Invoices copy these values rather than referencing them live, so updating a
 * rate never rewrites an invoice that has already gone out.
 */
export interface IService {
  _id: Types.ObjectId
  code: string
  name: string
  description?: string
  category?: string
  pricingModel: PricingModel
  rate: IMoney
  /** Tier-specific rate card targets (small, medium, large client tiers). */
  tierRates?: IServiceTierRate[]
  /** Label for what one unit is: "hour", "sprint", "page". */
  unit?: string
  taxRatePct: number
  isActive: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ServiceTierRateSchema = new Schema<IServiceTierRate>(
  {
    tier: { type: String, enum: ['small', 'medium', 'large'], required: true },
    hourlyRate: { type: MoneySchema, required: true },
    dayRate: { type: MoneySchema, required: true },
  },
  { _id: false },
)

const ServiceSchema = new Schema<IService>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String },
    category: { type: String, trim: true },
    pricingModel: { type: String, enum: PRICING_MODELS, required: true, default: 'fixed' },
    rate: { type: MoneySchema, required: true },
    tierRates: { type: [ServiceTierRateSchema], default: [] },
    unit: { type: String, trim: true },
    taxRatePct: { type: Number, required: true, default: 0, min: 0, max: 100 },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

ServiceSchema.index({ isActive: 1, category: 1 })

export const Service: Model<IService> = (models.Service as Model<IService>) ?? model<IService>('Service', ServiceSchema)
