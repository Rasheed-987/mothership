import { notFound } from 'next/navigation'
import { requireAuth, can } from '@/lib/dal'
import { getPricingSheet, listRateCard } from '@/lib/services/pricing'
import { getProjectById } from '@/lib/services/projects'
import PricingSheetView from './pricing-sheet-view'

interface PricingSheetPageProps {
  params: { id: string }
}

export default async function PricingSheetPage({ params }: PricingSheetPageProps) {
  await requireAuth()

  const [sheet, canEdit] = await Promise.all([getPricingSheet(params.id), can('project.update')])

  if (!sheet) {
    // No sheet yet — confirm the project exists, then offer to start one.
    const project = await getProjectById(params.id)
    if (!project) notFound()
    return (
      <PricingSheetView
        sheet={null}
        project={{ id: project.id, name: project.name, clientName: project.clientName }}
        canEdit={canEdit}
        services={[]}
      />
    )
  }

  const services = canEdit ? await listRateCard() : []

  return (
    <PricingSheetView
      sheet={sheet}
      project={{ id: sheet.projectId, name: sheet.projectName, clientName: sheet.clientName }}
      canEdit={canEdit}
      services={services.map((s) => ({ id: s.id, name: s.name }))}
    />
  )
}
