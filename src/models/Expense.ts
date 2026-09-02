import { Schema, model, models, type Model, type Types } from 'mongoose'

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'reimbursed'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export const EXPENSE_CATEGORIES = [
  'software',
  'travel',
  'contractor',
  'hardware',
  'marketing',
  'office',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface IExpense {
  _id: Types.ObjectId
  projectId?: Types.ObjectId | null
  clientId?: Types.ObjectId | null
  category: ExpenseCategory
  description: string
  /** Minor units. */
  amount: number
  currency: string
  date: Date
  vendor?: string
  receiptUrl?: string | null
  billable: boolean
  /** This pair is what the finance manager role actually acts on. */
  status: ExpenseStatus
  submittedBy: Types.ObjectId
  approvedBy?: Types.ObjectId | null
  approvedAt?: Date | null
  rejectionReason?: string | null
  createdAt: Date
  updatedAt: Date
}

const ExpenseSchema = new Schema<IExpense>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, default: 'other' },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    date: { type: Date, required: true, default: Date.now },
    vendor: { type: String, trim: true },
    receiptUrl: { type: String, default: null },
    billable: { type: Boolean, required: true, default: false },
    status: { type: String, enum: EXPENSE_STATUSES, required: true, default: 'pending' },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
)

ExpenseSchema.index({ status: 1, date: -1 })
ExpenseSchema.index({ projectId: 1, status: 1 })
ExpenseSchema.index({ submittedBy: 1, date: -1 })

export const Expense: Model<IExpense> = (models.Expense as Model<IExpense>) ?? model<IExpense>('Expense', ExpenseSchema)
