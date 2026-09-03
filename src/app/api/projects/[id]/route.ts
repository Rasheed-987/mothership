import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/dal'
import {
  deleteProject,
  getProjectById,
  updateProject,
  updateProjectSchema,
  updateTracker,
  trackerSchema,
} from '@/lib/services/projects'
import { apiError, readJson } from '../../_helpers'

type Ctx = { params: { id: string } }

/** GET /api/projects/:id — one project, fully resolved for the detail page. */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePermission('project.view')
    const project = await getProjectById(ctx.params.id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * PATCH /api/projects/:id — update a subset of fields.
 *
 * Core fields go straight through. Pass `{ tracker: {...} }` to replace the
 * timeline / activity / checklist instead (recomputes progress, stamps the date).
 */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('project.update')
    const raw = (await readJson(request)) as Record<string, unknown>

    if (raw && typeof raw === 'object' && 'tracker' in raw) {
      const body = trackerSchema.parse(raw.tracker)
      const project = await updateTracker(actor, ctx.params.id, body)
      return NextResponse.json({ project })
    }

    const body = updateProjectSchema.parse(raw)
    const project = await updateProject(actor, ctx.params.id, body)
    return NextResponse.json({ project })
  } catch (err) {
    return apiError(err)
  }
}

/** DELETE /api/projects/:id — remove a project. */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission('project.delete')
    await deleteProject(actor, ctx.params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err)
  }
}
