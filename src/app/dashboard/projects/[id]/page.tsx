import { notFound } from 'next/navigation'
import { requireAuth, can } from '@/lib/dal'
import { getProjectById, listTeamOptions } from '@/lib/services/projects'
import { listClients } from '@/lib/services/clients'
import ProjectDetailView from './project-detail-view'

interface ProjectDetailPageProps {
  params: {
    id: string
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  await requireAuth()

  const project = await getProjectById(params.id)
  if (!project) {
    notFound()
  }

  const canEdit = await can('project.update')

  const [clients, team] = canEdit
    ? await Promise.all([listClients(), listTeamOptions()])
    : [[], []]

  return (
    <ProjectDetailView
      project={project}
      canEdit={canEdit}
      clientOptions={clients.map((c) => ({ id: c.id, name: c.name }))}
      teamOptions={team}
    />
  )
}
