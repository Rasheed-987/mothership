import { Schema, type Types } from 'mongoose'

/**
 * Money is stored as an integer in the currency's minor unit (paisa, cents).
 * Never a float: 0.1 + 0.2 !== 0.3, and those errors compound across an
 * invoice's line items until the total is visibly wrong.
 */
export interface IMoney {
  amount: number
  currency: string
}

export const MoneySchema = new Schema<IMoney>(
  {
    amount: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Money must be an integer in minor units (e.g. 1500 for 15.00)',
      },
    },
    currency: { type: String, required: true, default: 'INR', uppercase: true, trim: true, minlength: 3, maxlength: 3 },
  },
  { _id: false },
)

export type Ref = Types.ObjectId

export const objectId = (ref: string, required = false) => ({
  type: Schema.Types.ObjectId,
  ref,
  required,
})

/**
 * Client business size. Drives the rate card: the same role costs 2–3× more for a
 * large corporate than a small business. Lives here because Client, Project
 * (pricing sheet) and Service (tier rates) all speak it.
 */
export const CLIENT_TIERS = ['small', 'medium', 'large'] as const
export type ClientTier = (typeof CLIENT_TIERS)[number]

export const TIER_LABELS: Record<ClientTier, string> = {
  small: 'Small business',
  medium: 'Medium business',
  large: 'Large corporate',
}
