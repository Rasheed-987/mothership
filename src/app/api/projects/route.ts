import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import { createProject, projectSchema, listProjects } from '@/lib/services/projects'
import { apiError, readJson } from '../_helpers'

/** GET /api/projects — every project with client name, health and progress. */
export async function GET() {
  try {
    await requirePermission('project.view')
    return NextResponse.json({ projects: await listProjects() })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/projects — create a project.
 *
 * Body: { name, clientId, category?, status?, health?, daysBehind?, revisionRounds?,
 *         plannedDuration?, progressNote?, startDate?, dueDate?, value?, managerId?,
 *         remarks?, description?, clientVisible?, resources? }
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission('project.create')
    const body = projectSchema.parse(await readJson(request))
    const project = await createProject(actor, body)
    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    return apiError(err)
  }
}
