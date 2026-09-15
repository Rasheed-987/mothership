import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface IFinancialSnapshotPL {
  retainers: number
  projectFees: number
  mediaComm: number
  totalRev: number
  directCosts: number
  grossProfit: number
  salaries: number
  rent: number
  software: number
  marketing: number
  other: number
  totalOpex: number
  ebitda: number
  depreciation: number
  netProfit: number
  netMargin: number
}

export interface IFinancialSnapshotBS {
  cash: number
  ar: number
  fixedAssets: number
  totalAssets: number
  ap: number
  loans: number
  accrued: number
  totalLiab: number
  shareCapital: number
  retained: number
  totalEquity: number
}

export interface IFinancialSnapshotCF {
  operating: number
  investing: number
  financing: number
  netChange: number
  opening: number
  closing: number
}

export interface IFinancialSnapshot {
  _id: Types.ObjectId
  /** Format: YYYY-MM */
  period: string
  pl: IFinancialSnapshotPL
  bs: IFinancialSnapshotBS
  cf: IFinancialSnapshotCF
  createdBy?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const FinancialSnapshotSchema = new Schema<IFinancialSnapshot>(
  {
    period: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}$/ },
    pl: { type: Schema.Types.Mixed, required: true },
    bs: { type: Schema.Types.Mixed, required: true },
    cf: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)


export const FinancialSnapshot: Model<IFinancialSnapshot> =
  (models.FinancialSnapshot as Model<IFinancialSnapshot>) ??
  model<IFinancialSnapshot>('FinancialSnapshot', FinancialSnapshotSchema)
