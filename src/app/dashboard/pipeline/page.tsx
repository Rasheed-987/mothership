import { requireAuth, can } from '@/lib/dal'
import { getPipeline } from '@/lib/services/deals'
import { listTeamOptions } from '@/lib/services/projects'
import { listClients } from '@/lib/services/clients'
import PipelineView from './pipeline-view'

export default async function PipelinePage() {
  await requireAuth()

  const [pipeline, canEdit, canCreate] = await Promise.all([
    getPipeline(),
    can('deal.update'),
    can('deal.create'),
  ])
  const [clients, team] = canCreate ? await Promise.all([listClients(), listTeamOptions()]) : [[], []]

  return (
    <PipelineView
      pipeline={pipeline}
      canEdit={canEdit}
      canCreate={canCreate}
      clientOptions={clients.map((c) => ({ id: c.id, name: c.name }))}
      teamOptions={team}
    />
  )
}
