import { requireAuth, can } from '@/lib/dal'
import { listProjects, listTeamOptions } from '@/lib/services/projects'
import { listClients } from '@/lib/services/clients'
import ProjectsView from './projects-view'

export default async function ProjectsPage() {
  await requireAuth()

  const [projects, canCreate] = await Promise.all([listProjects(), can('project.create')])
  const [clients, team] = canCreate
    ? await Promise.all([listClients(), listTeamOptions()])
    : [[], []]

  return (
    <ProjectsView
      projects={projects}
      canCreate={canCreate}
      clientOptions={clients.map((c) => ({ id: c.id, name: c.name }))}
      teamOptions={team}
    />
  )
}
