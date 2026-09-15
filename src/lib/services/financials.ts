import 'server-only'
import { connectDB } from '@/lib/db'
import { Invoice } from '@/models/Invoice'
import { Payment } from '@/models/Payment'
import { Expense } from '@/models/Expense'
import { Project } from '@/models/Project'
import { VendorPayment, type IVendorPayment } from '@/models/VendorPayment'
import { FinancialSnapshot, type IFinancialSnapshotPL, type IFinancialSnapshotBS, type IFinancialSnapshotCF } from '@/models/FinancialSnapshot'
import { Client } from '@/models/Client'
import type { CurrentUser } from '@/lib/authz'

export interface IFinancialStatementsData {
  ym: string
  pl: IFinancialSnapshotPL
  bs: IFinancialSnapshotBS
  cf: IFinancialSnapshotCF
}

export interface IVendorPaymentRow {
  id: string
  vendor: string
  client: string
  project: string
  cost: number
  paid: number
  remaining: number
  status: string
}

export interface IReconTransactionRow {
  id: string
  date: string
  client: string
  project: string
  invoice: string
  amount: number
  notes: string
}

export interface ICompletedProjectRow {
  id: string
  project: string
  client: string
  invoice: string
  date: string
  value: number
}

/* Helper to seed deterministic fallback P&L / BS / CF for demo preview */
function finRng(seed: number) {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function finR(n: number, step = 1000) {
  return Math.round(n / step) * step
}

export function generateDeterministicStatement(ym: string): IFinancialStatementsData {
  const [yStr, mStr] = ym.split('-')
  const y = parseInt(yStr || '2026', 10)
  const mo = parseInt(mStr || '06', 10)
  const idx = (y - 2025) * 12 + (mo - 1)
  const rnd = finRng(y * 100 + mo)
  const growth = Math.pow(1.015, Math.max(0, idx))
  const season = [1, 0.95, 1.05, 1.02, 1.08, 1.12, 0.9, 0.86, 1.1, 1.16, 1.22, 1.0][mo - 1] || 1

  // P&L
  const retainers = finR(260000 * growth * (0.96 + rnd() * 0.07))
  const projectFees = finR(225000 * growth * season * (0.85 + rnd() * 0.4))
  const mediaComm = finR(68000 * growth * season * (0.8 + rnd() * 0.5))
  const totalRev = retainers + projectFees + mediaComm
  const directCosts = finR(totalRev * (0.33 + rnd() * 0.06))
  const grossProfit = totalRev - directCosts
  const salaries = finR(178000 * Math.pow(1.008, Math.max(0, idx)))
  const rent = 42000
  const software = finR(14000 + rnd() * 4000, 500)
  const marketing = finR(16000 * season, 500)
  const other = finR(11000 + rnd() * 8000, 500)
  const totalOpex = salaries + rent + software + marketing + other
  const ebitda = grossProfit - totalOpex
  const depreciation = 9000
  const netProfit = ebitda - depreciation
  const netMargin = totalRev ? netProfit / totalRev : 0

  const pl: IFinancialSnapshotPL = {
    retainers,
    projectFees,
    mediaComm,
    totalRev,
    directCosts,
    grossProfit,
    salaries,
    rent,
    software,
    marketing,
    other,
    totalOpex,
    ebitda,
    depreciation,
    netProfit,
    netMargin,
  }

  // CF
  const wc = finR((rnd() - 0.5) * 90000)
  const operating = netProfit + depreciation + wc
  const investing = -finR(rnd() * 26000) - (mo % 6 === 0 ? 60000 : 0)
  const financing = mo % 6 === 0 ? -40000 : 0
  const netChange = operating + investing + financing
  const opening = 1200000 + idx * 25000
  const closing = opening + netChange

  const cf: IFinancialSnapshotCF = {
    operating,
    investing,
    financing,
    netChange,
    opening,
    closing,
  }

  // BS
  const cash = closing
  const ar = finR(totalRev * (0.8 + rnd() * 0.5))
  const fixedAssets = Math.max(120000, 320000 - idx * 3500)
  const totalAssets = cash + ar + fixedAssets
  const ap = finR(directCosts * (0.5 + rnd() * 0.4))
  const loans = Math.max(0, 500000 - idx * 8000)
  const accrued = finR(salaries * 0.4)
  const totalLiab = ap + loans + accrued
  const shareCapital = 250000
  const retained = totalAssets - totalLiab - shareCapital
  const totalEquity = shareCapital + retained

  const bs: IFinancialSnapshotBS = {
    cash,
    ar,
    fixedAssets,
    totalAssets,
    ap,
    loans,
    accrued,
    totalLiab,
    shareCapital,
    retained,
    totalEquity,
  }

  return { ym, pl, bs, cf }
}

export async function getFinancialStatements(ym: string): Promise<IFinancialStatementsData> {
  await connectDB()

  // 1. Check if snapshot exists for this period
  const snapshot = await FinancialSnapshot.findOne({ period: ym }).lean()
  if (snapshot) {
    return {
      ym: snapshot.period,
      pl: snapshot.pl,
      bs: snapshot.bs,
      cf: snapshot.cf,
    }
  }

  // 2. Otherwise generate statement
  return generateDeterministicStatement(ym)
}

/* ============================================================
   VENDOR PAYMENTS
   ============================================================ */

export async function getVendorPayments(): Promise<IVendorPaymentRow[]> {
  await connectDB()
  const rows = await VendorPayment.find().sort({ createdAt: -1 }).lean()

  return rows.map((r) => {
    const cost = r.cost || 0
    const paid = r.paid || 0
    const rem = Math.max(0, cost - paid)
    let status = 'Unpaid'
    if (paid >= cost && cost > 0) status = 'Paid'
    else if (paid > 0) status = 'Partially Paid'

    return {
      id: String(r._id),
      vendor: r.vendorName,
      client: r.clientName || 'General Agency',
      project: r.projectName || 'General Work',
      cost,
      paid,
      remaining: rem,
      status,
    }
  })
}

export async function createVendorPaymentAction(
  actor: CurrentUser,
  data: { vendorName: string; clientName?: string; projectName?: string; cost: number; paid: number },
): Promise<IVendorPaymentRow> {
  await connectDB()
  const doc = await VendorPayment.create({
    vendorName: data.vendorName.trim(),
    clientName: (data.clientName || '').trim(),
    projectName: (data.projectName || '').trim(),
    cost: Number(data.cost || 0),
    paid: Number(data.paid || 0),
    currency: 'AED',
    status: data.paid >= data.cost && data.cost > 0 ? 'paid' : data.paid > 0 ? 'partial' : 'unpaid',
    createdBy: actor.id,
  })

  const cost = doc.cost || 0
  const paid = doc.paid || 0
  return {
    id: String(doc._id),
    vendor: doc.vendorName,
    client: doc.clientName || 'General Agency',
    project: doc.projectName || 'General Work',
    cost,
    paid,
    remaining: Math.max(0, cost - paid),
    status: paid >= cost && cost > 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
  }
}

export async function updateVendorPaymentAction(
  _actor: CurrentUser,
  id: string,
  data: { vendorName: string; clientName?: string; projectName?: string; cost: number; paid: number },
) {
  await connectDB()
  const cost = Number(data.cost || 0)
  const paid = Number(data.paid || 0)
  const status = paid >= cost && cost > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'

  await VendorPayment.findByIdAndUpdate(id, {
    vendorName: data.vendorName.trim(),
    clientName: (data.clientName || '').trim(),
    projectName: (data.projectName || '').trim(),
    cost,
    paid,
    status,
  })
}

export async function deleteVendorPaymentAction(_actor: CurrentUser, id: string) {
  await connectDB()
  await VendorPayment.findByIdAndDelete(id)
}

/* ============================================================
   BANK RECONCILIATION
   ============================================================ */

export async function getBankReconciliation(ym: string): Promise<IReconTransactionRow[]> {
  await connectDB()

  // Query payments in this month or with reconciliation notes
  const [yStr, mStr] = ym.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  const payments = await Payment.find({
    receivedAt: { $gte: startDate, $lte: endDate },
  })
    .populate('clientId', 'name')
    .populate('invoiceId', 'number')
    .lean()

  return payments.map((p: any) => ({
    id: String(p._id),
    date: p.receivedAt.toISOString().slice(0, 10),
    client: p.clientId?.name || 'Client',
    project: p.reference || 'Engagement',
    invoice: p.invoiceId?.number || 'INV-2026-000',
    amount: p.amount,
    notes: p.notes || 'Part payment received via bank transfer.',
  }))
}

export async function createReconTransactionAction(
  actor: CurrentUser,
  data: { date: string; clientName: string; projectName: string; invoiceNumber: string; amount: number; notes: string },
) {
  await connectDB()

  // Find or create client
  let client = await Client.findOne({ name: new RegExp(`^${data.clientName.trim()}$`, 'i') })
  if (!client) {
    client = await Client.create({ name: data.clientName.trim(), createdBy: actor.id })
  }

  // Create payment record
  await Payment.create({
    invoiceId: client._id, // fallback provenance reference
    clientId: client._id,
    amount: Number(data.amount || 0),
    currency: 'AED',
    method: 'bank_transfer',
    reference: data.projectName.trim(),
    notes: data.notes.trim(),
    receivedAt: new Date(data.date),
    reconciled: true,
    reconciledAt: new Date(),
    recordedBy: actor.id,
  })
}

export async function deleteReconTransactionAction(_actor: CurrentUser, id: string) {
  await connectDB()
  await Payment.findByIdAndDelete(id)
}

/* ============================================================
   PROJECTS COMPLETED
   ============================================================ */

export async function getCompletedProjects(ym: string): Promise<ICompletedProjectRow[]> {
  await connectDB()

  const [yStr, mStr] = ym.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  const projects = await Project.find({
    status: 'completed',
    completedAt: { $gte: startDate, $lte: endDate },
  })
    .populate('clientId', 'name')
    .lean()

  const projectIds = projects.map((p) => p._id)
  const invoices = await Invoice.find({ projectId: { $in: projectIds } }).lean()

  const invoiceMap = new Map<string, string>()
  invoices.forEach((inv) => {
    if (inv.projectId) invoiceMap.set(String(inv.projectId), inv.number)
  })

  return projects.map((p: any) => ({
    id: String(p._id),
    project: p.name,
    client: p.clientId?.name || 'Client',
    invoice: invoiceMap.get(String(p._id)) || `INV-${p.code}`,
    date: p.completedAt ? p.completedAt.toISOString().slice(0, 10) : ym + '-15',
    value: p.budget?.amount ? Math.round(p.budget.amount / 100) : 50000,
  }))
}

export async function createCompletedProjectAction(
  actor: CurrentUser,
  data: { project: string; clientName: string; invoiceNumber: string; date: string; value: number },
) {
  await connectDB()

  let client = await Client.findOne({ name: new RegExp(`^${data.clientName.trim()}$`, 'i') })
  if (!client) {
    client = await Client.create({ name: data.clientName.trim(), createdBy: actor.id })
  }

  const projCode = 'PRJ-' + Math.floor(100 + Math.random() * 900)

  await Project.create({
    code: projCode,
    name: data.project.trim(),
    clientId: client._id,
    status: 'completed',
    completedAt: new Date(data.date),
    progressPct: 100,
    budget: { amount: Math.round(data.value * 100), currency: 'AED' },
    createdBy: actor.id,
  })
}

export async function deleteCompletedProjectAction(_actor: CurrentUser, id: string) {
  await connectDB()
  await Project.findByIdAndDelete(id)
}
