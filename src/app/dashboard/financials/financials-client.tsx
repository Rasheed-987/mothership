'use me' // client component marker for Next.js
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  IFinancialStatementsData,
  IVendorPaymentRow,
  IReconTransactionRow,
  ICompletedProjectRow,
} from '@/lib/services/financials'
import {
  createVendorPaymentFormAction,
  deleteVendorPaymentFormAction,
  createReconTransactionFormAction,
  deleteReconTransactionFormAction,
  createCompletedProjectFormAction,
  deleteCompletedProjectFormAction,
} from '@/app/actions/financials'

const FIN_MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatAed(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'AED 0'
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US')
  return n < 0 ? `−AED ${str}` : `AED ${str}`
}

function formatAedShort(n: number): string {
  if (Math.abs(n) >= 1000000) return `AED ${(n / 1000000).toFixed(1)}m`
  if (Math.abs(n) >= 1000) return `AED ${(n / 1000).toFixed(0)}k`
  return `AED ${n}`
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export default function FinancialsClient({
  ym,
  statements,
  vendorPayments,
  bankRecon,
  completedProjects,
}: {
  ym: string
  statements: IFinancialStatementsData
  vendorPayments: IVendorPaymentRow[]
  bankRecon: IReconTransactionRow[]
  completedProjects: ICompletedProjectRow[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'statements'
  const currentStmt = searchParams.get('stmt') || 'pl'

  // Modal states
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showReconModal, setShowReconModal] = useState(false)
  const [showCompModal, setShowCompModal] = useState(false)
  const [vendorFilter, setVendorFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [yearStr, monthStr] = ym.split('-')
  const selectedYear = parseInt(yearStr || '2026', 10)
  const selectedMonth = parseInt(monthStr || '06', 10)

  const handleMonthChange = (newMonth: number, newYear: number) => {
    const newYm = `${newYear}-${newMonth < 10 ? '0' : ''}${newMonth}`
    const params = new URLSearchParams(searchParams.toString())
    params.set('ym', newYm)
    router.push(`/dashboard/financials?${params.toString()}`)
  }

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/dashboard/financials?${params.toString()}`)
  }

  const handleStmtChange = (stmt: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('stmt', stmt)
    router.push(`/dashboard/financials?${params.toString()}`)
  }

  // Filtered vendor payments
  const filteredVendors = vendorPayments.filter((r) => {
    if (vendorFilter && r.status !== vendorFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.vendor.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Totals for vendor payments
  const totCost = filteredVendors.reduce((acc, r) => acc + r.cost, 0)
  const totPaid = filteredVendors.reduce((acc, r) => acc + r.paid, 0)
  const totRem = filteredVendors.reduce((acc, r) => acc + r.remaining, 0)
  const settledPct = totCost ? Math.round((totPaid / totCost) * 100) : 0

  // Totals for recon & completed
  const reconTotal = bankRecon.reduce((acc, r) => acc + r.amount, 0)
  const compTotal = completedProjects.reduce((acc, r) => acc + r.value, 0)

  const { pl, bs, cf } = statements

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-3 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Financials</h1>
          <p className="mt-1 text-sm text-muted">
            Executive view of agency finances in AED. Live Mongo DB metrics &amp; statements.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-1 text-xs font-semibold text-muted">
          <span className="px-2 py-1">Period:</span>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(parseInt(e.target.value, 10), selectedYear)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-ink focus:outline-none"
          >
            {FIN_MO.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => handleMonthChange(selectedMonth, parseInt(e.target.value, 10))}
            className="rounded-md border border-line bg-surface px-2 py-1 text-ink focus:outline-none"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {[
          { id: 'statements', label: 'Financial Statements' },
          { id: 'vendors', label: 'Vendor Payments' },
          { id: 'recon', label: 'Bank Reconciliation' },
          { id: 'completed', label: 'Projects Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              currentTab === tab.id
                ? 'bg-ink text-surface shadow-sm'
                : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FINANCIAL STATEMENTS */}
      {currentTab === 'statements' && (
        <div className="space-y-6">
          {/* Statement Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-medium text-muted">
              Showing statement for <span className="font-bold text-ink">{FIN_MO[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <div className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1 text-xs">
              {[
                { id: 'pl', label: 'P&L' },
                { id: 'bs', label: 'Balance Sheet' },
                { id: 'cf', label: 'Cash Flow' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStmtChange(s.id)}
                  className={`rounded-md px-3 py-1.5 font-semibold transition ${
                    currentStmt === s.id
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Statement Hero Card */}
          {currentStmt === 'pl' && (
            <div className="grid grid-cols-1 gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Net Profit</div>
                <div className="mt-1 text-3xl font-extrabold text-ink">{formatAed(pl.netProfit)}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600">
                    {formatPct(pl.netMargin)} net margin
                  </span>
                  <span>on {formatAedShort(pl.totalRev)} revenue</span>
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <div className="text-xs font-semibold text-muted">Revenue &amp; Cost Breakdown</div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-surface-3 flex">
                  <div className="bg-blue-600" style={{ width: `${(pl.directCosts / (pl.totalRev || 1)) * 100}%` }} title="Direct Costs" />
                  <div className="bg-amber-500" style={{ width: `${(pl.totalOpex / (pl.totalRev || 1)) * 100}%` }} title="OpEx" />
                  <div className="bg-emerald-500" style={{ width: `${(pl.netProfit / (pl.totalRev || 1)) * 100}%` }} title="Net Profit" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />Direct: {formatAedShort(pl.directCosts)}</div>
                  <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />OpEx: {formatAedShort(pl.totalOpex)}</div>
                  <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Profit: {formatAedShort(pl.netProfit)}</div>
                </div>
              </div>
            </div>
          )}

          {currentStmt === 'bs' && (
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Total Assets</div>
              <div className="mt-1 text-3xl font-extrabold text-ink">{formatAed(bs.totalAssets)}</div>
              <div className="mt-2 text-xs font-medium text-emerald-600">
                ✓ Balanced · Total Assets = Liabilities ({formatAedShort(bs.totalLiab)}) + Equity ({formatAedShort(bs.totalEquity)})
              </div>
            </div>
          )}

          {currentStmt === 'cf' && (
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Closing Cash</div>
              <div className="mt-1 text-3xl font-extrabold text-ink">{formatAed(cf.closing)}</div>
              <div className="mt-2 text-xs text-muted">
                Net change this month: <span className={cf.netChange >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{formatAed(cf.netChange)}</span> (Opened at {formatAedShort(cf.opening)})
              </div>
            </div>
          )}

          {/* Statement Table */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Line Item</th>
                  <th className="px-4 py-3 text-right">Amount (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink">
                {currentStmt === 'pl' && (
                  <>
                    <tr className="bg-surface-2/50 font-bold uppercase text-muted text-[11px]"><td colSpan={2} className="px-4 py-2">Revenue</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Retainers</td><td className="px-4 py-2.5 text-right">{formatAed(pl.retainers)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Project Fees</td><td className="px-4 py-2.5 text-right">{formatAed(pl.projectFees)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Media Commissions</td><td className="px-4 py-2.5 text-right">{formatAed(pl.mediaComm)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Total Revenue</td><td className="px-4 py-2.5 text-right">{formatAed(pl.totalRev)}</td></tr>
                    <tr><td className="px-4 py-2.5">Direct Costs</td><td className="px-4 py-2.5 text-right">{formatAed(pl.directCosts)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Gross Profit</td><td className="px-4 py-2.5 text-right">{formatAed(pl.grossProfit)}</td></tr>
                    <tr className="bg-surface-2/50 font-bold uppercase text-muted text-[11px]"><td colSpan={2} className="px-4 py-2">Operating Expenses</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Salaries</td><td className="px-4 py-2.5 text-right">{formatAed(pl.salaries)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Rent</td><td className="px-4 py-2.5 text-right">{formatAed(pl.rent)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Software</td><td className="px-4 py-2.5 text-right">{formatAed(pl.software)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Marketing</td><td className="px-4 py-2.5 text-right">{formatAed(pl.marketing)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Other OpEx</td><td className="px-4 py-2.5 text-right">{formatAed(pl.other)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Total OpEx</td><td className="px-4 py-2.5 text-right">{formatAed(pl.totalOpex)}</td></tr>
                    <tr className="bg-surface-3 font-extrabold text-sm"><td className="px-4 py-3">Net Profit</td><td className="px-4 py-3 text-right">{formatAed(pl.netProfit)}</td></tr>
                  </>
                )}
                {currentStmt === 'bs' && (
                  <>
                    <tr className="bg-surface-2/50 font-bold uppercase text-muted text-[11px]"><td colSpan={2} className="px-4 py-2">Assets</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Cash</td><td className="px-4 py-2.5 text-right">{formatAed(bs.cash)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Accounts Receivable (AR)</td><td className="px-4 py-2.5 text-right">{formatAed(bs.ar)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Fixed Assets</td><td className="px-4 py-2.5 text-right">{formatAed(bs.fixedAssets)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Total Assets</td><td className="px-4 py-2.5 text-right">{formatAed(bs.totalAssets)}</td></tr>
                    <tr className="bg-surface-2/50 font-bold uppercase text-muted text-[11px]"><td colSpan={2} className="px-4 py-2">Liabilities</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Accounts Payable (AP)</td><td className="px-4 py-2.5 text-right">{formatAed(bs.ap)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Loans</td><td className="px-4 py-2.5 text-right">{formatAed(bs.loans)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Accrued Expenses</td><td className="px-4 py-2.5 text-right">{formatAed(bs.accrued)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Total Liabilities</td><td className="px-4 py-2.5 text-right">{formatAed(bs.totalLiab)}</td></tr>
                    <tr className="bg-surface-2/50 font-bold uppercase text-muted text-[11px]"><td colSpan={2} className="px-4 py-2">Equity</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Share Capital</td><td className="px-4 py-2.5 text-right">{formatAed(bs.shareCapital)}</td></tr>
                    <tr><td className="px-4 py-2.5 pl-8">Retained Earnings</td><td className="px-4 py-2.5 text-right">{formatAed(bs.retained)}</td></tr>
                    <tr className="bg-surface-3 font-extrabold text-sm"><td className="px-4 py-3">Total Liabilities + Equity</td><td className="px-4 py-3 text-right">{formatAed(bs.totalLiab + bs.totalEquity)}</td></tr>
                  </>
                )}
                {currentStmt === 'cf' && (
                  <>
                    <tr><td className="px-4 py-2.5">Cash from Operating Activities</td><td className="px-4 py-2.5 text-right">{formatAed(cf.operating)}</td></tr>
                    <tr><td className="px-4 py-2.5">Cash from Investing Activities</td><td className="px-4 py-2.5 text-right">{formatAed(cf.investing)}</td></tr>
                    <tr><td className="px-4 py-2.5">Cash from Financing Activities</td><td className="px-4 py-2.5 text-right">{formatAed(cf.financing)}</td></tr>
                    <tr className="bg-surface-2 font-bold"><td className="px-4 py-2.5">Net Change in Cash</td><td className="px-4 py-2.5 text-right">{formatAed(cf.netChange)}</td></tr>
                    <tr><td className="px-4 py-2.5">Opening Cash Balance</td><td className="px-4 py-2.5 text-right">{formatAed(cf.opening)}</td></tr>
                    <tr className="bg-surface-3 font-extrabold text-sm"><td className="px-4 py-3">Closing Cash Balance</td><td className="px-4 py-3 text-right">{formatAed(cf.closing)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VENDOR PAYMENTS */}
      {currentTab === 'vendors' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Cost</div>
              <div className="mt-1 text-xl font-bold text-ink">{formatAed(totCost)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Paid</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">{formatAed(totPaid)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Remaining</div>
              <div className="mt-1 text-xl font-bold text-amber-600">{formatAed(totRem)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Settlement</div>
              <div className="mt-1 text-xl font-bold text-ink">{settledPct}%</div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <input
                type="text"
                placeholder="Search vendor, client, project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink focus:outline-none"
              />
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink focus:outline-none"
              >
                <option value="">Any Status</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <button
              onClick={() => setShowVendorModal(true)}
              className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-surface shadow transition hover:opacity-90"
            >
              + Add Vendor Payment
            </button>
          </div>

          {/* Vendors Table */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink">
                {filteredVendors.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-bold">{r.vendor}</td>
                    <td className="px-4 py-3">{r.client}</td>
                    <td className="px-4 py-3">{r.project}</td>
                    <td className="px-4 py-3 text-right">{formatAed(r.cost)}</td>
                    <td className="px-4 py-3 text-right">{formatAed(r.paid)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatAed(r.remaining)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : r.status === 'Partially Paid'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-surface-3 text-muted'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async (fd) => {
                          await deleteVendorPaymentFormAction({}, fd)
                        }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-rose-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted">
                      No vendor payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BANK RECONCILIATION */}
      {currentTab === 'recon' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-ink">Bank Reconciliation Ledger</h2>
              <p className="text-xs text-muted">
                Logged deposits for {FIN_MO[selectedMonth - 1]} {selectedYear} ({formatAed(reconTotal)})
              </p>
            </div>
            <button
              onClick={() => setShowReconModal(true)}
              className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-surface shadow transition hover:opacity-90"
            >
              + Log Deposit / Transaction
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Project / Ref</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink">
                {bankRecon.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono">{r.date}</td>
                    <td className="px-4 py-3 font-bold">{r.client}</td>
                    <td className="px-4 py-3">{r.project}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{r.invoice}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatAed(r.amount)}</td>
                    <td className="px-4 py-3 text-muted max-w-xs truncate">{r.notes}</td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async (fd) => {
                          await deleteReconTransactionFormAction({}, fd)
                        }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-rose-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {bankRecon.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted">
                      No deposits logged for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PROJECTS COMPLETED */}
      {currentTab === 'completed' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-ink">Projects Completed in {FIN_MO[selectedMonth - 1]} {selectedYear}</h2>
              <p className="text-xs text-muted">
                {completedProjects.length} projects completed · Total Billed: {formatAed(compTotal)}
              </p>
            </div>
            <button
              onClick={() => setShowCompModal(true)}
              className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-surface shadow transition hover:opacity-90"
            >
              + Add Completed Project
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium text-ink">
                {completedProjects.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-bold">{r.project}</td>
                    <td className="px-4 py-3">{r.client}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{r.invoice}</td>
                    <td className="px-4 py-3 font-mono">{r.date}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatAed(r.value)}</td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async (fd) => {
                          await deleteCompletedProjectFormAction({}, fd)
                        }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-rose-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {completedProjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      No completed projects recorded for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD VENDOR PAYMENT */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-ink mb-4">Add Vendor Payment</h3>
            <form
              action={async (fd) => {
                await createVendorPaymentFormAction({}, fd)
                setShowVendorModal(false)
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Vendor Name</label>
                <input name="vendorName" required placeholder="e.g. PixelForge Print" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Client Name</label>
                <input name="clientName" placeholder="e.g. PureHealth" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Project Name</label>
                <input name="projectName" placeholder="e.g. Brand Refresh" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Total Cost (AED)</label>
                  <input name="cost" type="number" required placeholder="50000" className="w-full rounded-lg border border-line p-2 text-ink" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount Paid (AED)</label>
                  <input name="paid" type="number" required placeholder="25000" className="w-full rounded-lg border border-line p-2 text-ink" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowVendorModal(false)} className="rounded-lg px-4 py-2 font-semibold text-muted hover:bg-surface-2">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-ink px-4 py-2 font-semibold text-surface">
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD RECON TRANSACTION */}
      {showReconModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-ink mb-4">Log Bank Deposit</h3>
            <form
              action={async (fd) => {
                await createReconTransactionFormAction({}, fd)
                setShowReconModal(false)
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input name="date" type="date" defaultValue={ym + '-15'} required className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Client Name</label>
                <input name="clientName" required placeholder="e.g. PureHealth" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Project / Ref</label>
                <input name="projectName" placeholder="e.g. SEHA Hospitals Uplift" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Invoice Number</label>
                <input name="invoiceNumber" placeholder="INV-2026-050" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount (AED)</label>
                <input name="amount" type="number" required placeholder="100000" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea name="notes" placeholder="e.g. 50% deposit payment" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowReconModal(false)} className="rounded-lg px-4 py-2 font-semibold text-muted hover:bg-surface-2">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-ink px-4 py-2 font-semibold text-surface">
                  Log Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD COMPLETED PROJECT */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h3 className="text-base font-bold text-ink mb-4">Add Completed Project</h3>
            <form
              action={async (fd) => {
                await createCompletedProjectFormAction({}, fd)
                setShowCompModal(false)
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Project Name</label>
                <input name="project" required placeholder="e.g. Ramadan Campaign 2026" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Client Name</label>
                <input name="clientName" required placeholder="e.g. Colorland Toys" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Completion Date</label>
                <input name="date" type="date" defaultValue={ym + '-15'} required className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Invoice Value (AED)</label>
                <input name="value" type="number" required placeholder="68000" className="w-full rounded-lg border border-line p-2 text-ink" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCompModal(false)} className="rounded-lg px-4 py-2 font-semibold text-muted hover:bg-surface-2">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-ink px-4 py-2 font-semibold text-surface">
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
