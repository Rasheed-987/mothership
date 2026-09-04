import { requireAuth, can } from '@/lib/dal'
import { listRateCard, listPricingSheets } from '@/lib/services/pricing'
import PricingView from './pricing-view'

export default async function PricingPage() {
  await requireAuth()

  const [rateCard, sheets, canEditRates, canEditSheets] = await Promise.all([
    listRateCard(),
    listPricingSheets(),
    can('service.update'),
    can('project.update'),
  ])

  return (
    <PricingView
      rateCard={rateCard}
      sheets={sheets}
      canEditRates={canEditRates}
      canEditSheets={canEditSheets}
    />
  )
}
