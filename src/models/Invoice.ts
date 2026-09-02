import { Schema, model, models, type Model, type Types } from 'mongoose'

export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface ILineItem {
  description: string
  /** Which rate-card entry this came from — provenance only, never read for price. */
  serviceId?: Types.ObjectId | null
  qty: number
  /** Minor units. Copied from the Service at creation time, then frozen. */
  unitPrice: number
  taxPct: number
  amount: number
  taxAmount: number
}

export interface IInvoice {
  _id: Types.ObjectId
  number: string
  clientId: Types.ObjectId
  projectId?: Types.ObjectId | null
  status: InvoiceStatus
  issueDate: Date
  dueDate: Date
  lineItems: ILineItem[]
  currency: string
  subtotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balance: number
  notes?: string
  sentAt?: Date | null
  paidAt?: Date | null
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const LineItemSchema = new Schema<ILineItem>(
  {
    description: { type: String, required: true, trim: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    qty: { type: Number, required: true, default: 1, min: 0 },
    unitPrice: { type: Number, required: true, default: 0 },
    taxPct: { type: Number, required: true, default: 0, min: 0, max: 100 },
    amount: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    status: { type: String, enum: INVOICE_STATUSES, required: true, default: 'draft' },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    lineItems: { type: [LineItemSchema], default: [] },
    currency: { type: String, required: true, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    subtotal: { type: Number, required: true, default: 0 },
    taxTotal: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, required: true, default: 0 },
    balance: { type: Number, required: true, default: 0 },
    notes: { type: String },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

/**
 * Totals are derived, so they are recomputed on every save rather than trusted
 * from the client. Rounding happens per line, once — rounding only at the end
 * lets sub-unit fractions accumulate into an off-by-one on the total.
 */
InvoiceSchema.pre('validate', async function () {
  let subtotal = 0
  let taxTotal = 0

  for (const item of this.lineItems) {
    item.amount = Math.round(item.qty * item.unitPrice)
    item.taxAmount = Math.round((item.amount * item.taxPct) / 100)
    subtotal += item.amount
    taxTotal += item.taxAmount
  }

  this.subtotal = subtotal
  this.taxTotal = taxTotal
  this.total = subtotal + taxTotal
  this.balance = this.total - this.amountPaid
})

InvoiceSchema.index({ status: 1, dueDate: 1 })
InvoiceSchema.index({ clientId: 1, issueDate: -1 })
InvoiceSchema.index({ projectId: 1 })

export const Invoice: Model<IInvoice> = (models.Invoice as Model<IInvoice>) ?? model<IInvoice>('Invoice', InvoiceSchema)
