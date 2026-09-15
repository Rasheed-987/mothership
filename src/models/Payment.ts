import { Schema, model, models, type Model, type Types } from 'mongoose'

export const PAYMENT_METHODS = ['bank_transfer', 'card', 'cash', 'cheque', 'upi', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Its own collection rather than an array on the invoice: payments are queried
 * on their own axis ("cash received this month", across every invoice), which
 * an embedded array cannot serve without unwinding every invoice in the system.
 */
export interface IPayment {
  _id: Types.ObjectId
  invoiceId: Types.ObjectId
  clientId: Types.ObjectId
  /** Minor units. */
  amount: number
  currency: string
  method: PaymentMethod
  reference?: string
  receivedAt: Date
  notes?: string
  reconciled?: boolean
  reconciledAt?: Date | null
  recordedBy: Types.ObjectId
  createdAt: Date
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    method: { type: String, enum: PAYMENT_METHODS, required: true, default: 'bank_transfer' },
    reference: { type: String, trim: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    notes: { type: String },
    reconciled: { type: Boolean, default: false },
    reconciledAt: { type: Date, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

PaymentSchema.index({ invoiceId: 1 })
PaymentSchema.index({ receivedAt: -1 })
PaymentSchema.index({ clientId: 1, receivedAt: -1 })

export const Payment: Model<IPayment> = (models.Payment as Model<IPayment>) ?? model<IPayment>('Payment', PaymentSchema)
