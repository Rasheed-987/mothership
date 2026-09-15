import { Suspense } from 'react'
import { requireAuth } from '@/lib/dal'
import {
  getFinancialStatements,
  getVendorPayments,
  getBankReconciliation,
  getCompletedProjects,
} from '@/lib/services/financials'
import FinancialsClient from './financials-client'

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; tab?: string; stmt?: string }>
}) {
  await requireAuth()

  const params = await searchParams
  const defaultYm = '2026-06'
  const ym = params.ym || defaultYm

  const [statements, vendorPayments, bankRecon, completedProjects] = await Promise.all([
    getFinancialStatements(ym),
    getVendorPayments(),
    getBankReconciliation(ym),
    getCompletedProjects(ym),
  ])

  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted">Loading Financials dashboard...</div>}>
      <FinancialsClient
        ym={ym}
        statements={statements}
        vendorPayments={vendorPayments}
        bankRecon={bankRecon}
        completedProjects={completedProjects}
      />
    </Suspense>
  )
}
