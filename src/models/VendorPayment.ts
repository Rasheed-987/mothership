import { Schema, model, models, type Model, type Types } from 'mongoose'

export const VENDOR_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const
export type VendorPaymentStatus = (typeof VENDOR_PAYMENT_STATUSES)[number]

export interface IVendorPayment {
  _id: Types.ObjectId
  vendorName: string
  clientId?: Types.ObjectId | null
  projectId?: Types.ObjectId | null
  projectName?: string
  clientName?: string
  /** Cost in minor units or whole AED units depending on convention (standardized as AED whole or minor). */
  cost: number
  paid: number
  currency: string
  status: VendorPaymentStatus
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const VendorPaymentSchema = new Schema<IVendorPayment>(
  {
    vendorName: { type: String, required: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    projectName: { type: String, trim: true },
    clientName: { type: String, trim: true },
    cost: { type: Number, required: true, min: 0, default: 0 },
    paid: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, default: 'AED', uppercase: true },
    status: { type: String, enum: VENDOR_PAYMENT_STATUSES, required: true, default: 'unpaid' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

VendorPaymentSchema.index({ vendorName: 1 })
VendorPaymentSchema.index({ clientId: 1 })
VendorPaymentSchema.index({ projectId: 1 })

export const VendorPayment: Model<IVendorPayment> =
  (models.VendorPayment as Model<IVendorPayment>) ?? model<IVendorPayment>('VendorPayment', VendorPaymentSchema)
