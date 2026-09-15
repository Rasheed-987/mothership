import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server'
import { connectDB } from '@/lib/db'
import { Project, PROJECT_STATUSES, PROJECT_HEALTH, STAGE_STATES } from '@/models/Project'
import { Client } from '@/models/Client'
import { User } from '@/models/User'
import { listProjects, getProjectById } from '@/lib/services/projects'

export function createCrmMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mothership-crm',
    version: '1.0.0',
  })





  // ----------------------------------------------------------------------------
  // Tool 1: List Projects
  // ----------------------------------------------------------------------------
  server.registerTool(
    'list_projects',
    {
      description:
        'List client projects from Mothership CRM with their status, delivery health, budget, and completion percentage',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [...PROJECT_STATUSES],
            description: 'Filter by project status (pipeline, active, completed, cancelled)',
          },
          search: {
            type: 'string',
            description: 'Search filter for project name or client name',
          },
        },
      }),
    },
    async (args: any) => {
      const { status, search } = args || {}
      try {
        await connectDB()
        let projects = await listProjects()

        if (status) {
          projects = projects.filter((p) => p.status === status)
        }

        if (search) {
          const q = String(search).toLowerCase().trim()
          projects = projects.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.clientName.toLowerCase().includes(q) ||
              p.code.toLowerCase().includes(q),
          )
        }

        const summary = projects.map((p) => ({
          code: p.code,
          name: p.name,
          client: p.clientName,
          status: p.status,
          health: p.health,
          daysBehind: p.daysBehind,
          valueAED: p.value,
          progress: `${p.percentComplete}%`,
        }))

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error listing projects: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  
  // ----------------------------------------------------------------------------
  // Tool 2: Get Full Project Context Dossier
  // ----------------------------------------------------------------------------
  server.registerTool(
    'get_project_context',
    {
      description:
        'Retrieve complete project context dossier including client info, timeline stages, deliverables, client asks, recent activity log, and delivery health by code or name',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Project code (e.g. "PRJ-OH-WEB", "PRJ-SEHA") or project name',
          },
        },
        required: ['identifier'],
      }),
    },
    async (args: any) => {
      const { identifier } = args || {}
      try {
        await connectDB()
        let project = await getProjectById(String(identifier).trim())

        // Fallback search by partial name if code didn't match
        if (!project) {
          const found = await Project.findOne({ name: new RegExp(String(identifier).trim(), 'i') })
            .select('code')
            .lean()
          if (found) {
            project = await getProjectById(found.code)
          }
        }

        if (!project) {
          return {
            content: [{ type: 'text', text: `Project "${identifier}" not found in CRM.` }],
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error retrieving project context: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 3: Log Project Activity / Meeting Notes
  // ----------------------------------------------------------------------------
  server.registerTool(
    'log_project_activity',
    {
      description:
        'Log an activity entry, client update, meeting takeaway, or decision directly into the project activity timeline',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          projectCode: {
            type: 'string',
            description: 'Project code (e.g. PRJ-OH-WEB)',
          },
          text: {
            type: 'string',
            description: 'The note, decision, or update summary to log',
          },
          pending: {
            type: 'boolean',
            description: 'Whether this update represents a pending action item',
            default: false,
          },
        },
        required: ['projectCode', 'text'],
      }),
    },
    async (args: any) => {
      const { projectCode, text, pending } = args || {}
      try {
        await connectDB()
        const project = await Project.findOne({ code: String(projectCode).toUpperCase().trim() })
        if (!project) {
          return {
            content: [{ type: 'text', text: `Project code "${projectCode}" not found.` }],
          }
        }

        project.activity.unshift({
          occurredOn: new Date(),
          text: String(text).trim(),
          pending: Boolean(pending),
        })

        await project.save()

        return {
          content: [
            {
              type: 'text',
              text: `Successfully logged activity to ${project.name} (${project.code}): "${String(text).trim()}"`,
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error logging activity: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 4: Update Project Delivery Health & Progress Note
  // ----------------------------------------------------------------------------
  server.registerTool(
    'update_project_health',
    {
      description:
        'Update delivery health status, days behind schedule, progress notes, or remarks for a project',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          projectCode: {
            type: 'string',
            description: 'Project code (e.g. PRJ-OH-WEB)',
          },
          health: {
            type: 'string',
            enum: [...PROJECT_HEALTH],
            description: '"on_track" or "behind"',
          },
          daysBehind: {
            type: 'integer',
            minimum: 0,
            description: 'Number of days behind schedule (0 if on track)',
          },
          progressNote: {
            type: 'string',
            description: 'Brief status summary of what is happening now',
          },
          delayNote: {
            type: 'string',
            description: 'Explanation if project is behind schedule',
          },
          status: {
            type: 'string',
            enum: [...PROJECT_STATUSES],
            description: 'Project lifecycle status (pipeline, active, completed, cancelled)',
          },
        },
        required: ['projectCode'],
      }),
    },
    async (args: any) => {
      const { projectCode, health, daysBehind, progressNote, delayNote, status } = args || {}
      try {
        await connectDB()
        const project = await Project.findOne({ code: String(projectCode).toUpperCase().trim() })
        if (!project) {
          return {
            content: [{ type: 'text', text: `Project code "${projectCode}" not found.` }],
          }
        }

        if (health) project.health = health
        if (daysBehind !== undefined) project.daysBehind = Number(daysBehind)
        if (progressNote !== undefined) project.progressNote = progressNote
        if (delayNote !== undefined) project.delayNote = delayNote
        if (status) project.status = status
        project.trackerUpdatedAt = new Date()

        await project.save()

        return {
          content: [
            {
              type: 'text',
              text: `Updated delivery health for ${project.name} (${project.code}): health=${project.health}, daysBehind=${project.daysBehind}`,
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error updating project health: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 5: Manage Client Asks ("What we need from you")
  // ----------------------------------------------------------------------------
  server.registerTool(
    'manage_client_asks',
    {
      description:
        'Manage deliverables needed from the client ("What we need from you"): add a new item or mark an item received',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          projectCode: {
            type: 'string',
            description: 'Project code (e.g. PRJ-OH-WEB)',
          },
          action: {
            type: 'string',
            enum: ['add', 'mark_received'],
            description: 'Add a new ask, or mark an existing one as received',
          },
          title: {
            type: 'string',
            description: 'Title of the deliverable/asset needed from client',
          },
          note: {
            type: 'string',
            description: 'Additional notes or instructions for the ask',
          },
          dueOn: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format',
          },
        },
        required: ['projectCode', 'action', 'title'],
      }),
    },
    async (args: any) => {
      const { projectCode, action, title, note, dueOn } = args || {}
      try {
        await connectDB()
        const project = await Project.findOne({ code: String(projectCode).toUpperCase().trim() })
        if (!project) {
          return {
            content: [{ type: 'text', text: `Project code "${projectCode}" not found.` }],
          }
        }

        if (action === 'add') {
          project.clientAsks.push({
            title: String(title).trim(),
            note: note ? String(note).trim() : undefined,
            dueOn: dueOn ? new Date(dueOn) : null,
            received: false,
          })
          await project.save()
          return {
            content: [{ type: 'text', text: `Added client ask "${title}" to project ${project.code}.` }],
          }
        }

        if (action === 'mark_received') {
          const item = project.clientAsks.find((a) =>
            a.title.toLowerCase().includes(String(title).toLowerCase().trim()),
          )
          if (!item) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Could not find a client ask matching "${title}" in project ${project.code}.`,
                },
              ],
            }
          }
          item.received = true
          await project.save()
          return {
            content: [
              {
                type: 'text',
                text: `Marked client ask "${item.title}" as received for project ${project.code}.`,
              },
            ],
          }
        }

        return { content: [{ type: 'text', text: 'Invalid action. Must be "add" or "mark_received".' }] }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error managing client asks: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 6: Manage Project Timeline Stages
  // ----------------------------------------------------------------------------
  server.registerTool(
    'manage_project_stage',
    {
      description:
        'Update an existing timeline stage state ("done", "active", "upcoming") or add a new stage to the plan',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          projectCode: {
            type: 'string',
            description: 'Project code (e.g. PRJ-OH-WEB)',
          },
          stageName: {
            type: 'string',
            description: 'Name of the stage (e.g. "Brand Discovery", "UI Design")',
          },
          state: {
            type: 'string',
            enum: [...STAGE_STATES],
            description: 'New state for the stage: "done", "active", or "upcoming"',
          },
          note: {
            type: 'string',
            description: 'Stage description or milestone note',
          },
        },
        required: ['projectCode', 'stageName', 'state'],
      }),
    },
    async (args: any) => {
      const { projectCode, stageName, state, note } = args || {}
      try {
        await connectDB()
        const project = await Project.findOne({ code: String(projectCode).toUpperCase().trim() })
        if (!project) {
          return {
            content: [{ type: 'text', text: `Project code "${projectCode}" not found.` }],
          }
        }

        const existing = project.stages.find(
          (s) => s.name.toLowerCase() === String(stageName).toLowerCase().trim(),
        )
        if (existing) {
          existing.state = state
          if (note) existing.note = String(note).trim()
        } else {
          project.stages.push({
            name: String(stageName).trim(),
            state,
            note: note ? String(note).trim() : undefined,
            owner: 'Human Saucer',
          })
        }

        await project.save()
        return {
          content: [
            {
              type: 'text',
              text: `Stage "${stageName}" on project ${project.code} is now set to "${state}".`,
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error updating project stage: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 7: List Clients
  // ----------------------------------------------------------------------------
  server.registerTool(
    'list_clients',
    {
      description: 'List clients in Mothership CRM with their tier, contact information, and active status',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search filter for client name or industry',
          },
        },
      }),
    },
    async (args: any) => {
      const { search } = args || {}
      try {
        await connectDB()
        const query = search
          ? {
              $or: [
                { name: new RegExp(String(search).trim(), 'i') },
                { industry: new RegExp(String(search).trim(), 'i') },
              ],
            }
          : {}

        const clients = await Client.find(query)
          .sort({ name: 1 })
          .select('name tier industry status contacts email')
          .lean()

        const summary = clients.map((c) => ({
          id: String(c._id),
          name: c.name,
          tier: c.tier,
          industry: c.industry || '—',
          status: c.status,
          email: c.email || '—',
        }))

        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error listing clients: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  // ----------------------------------------------------------------------------
  // Tool 8: Create a New Project
  // ----------------------------------------------------------------------------
  server.registerTool(
    'create_project',
    {
      description: 'Create a new project in Mothership CRM linked to a client',
      inputSchema: fromJsonSchema({
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name',
          },
          clientName: {
            type: 'string',
            description: 'Client name (will link to existing or create new)',
          },
          budgetAmountAED: {
            type: 'number',
            minimum: 0,
            description: 'Total budget amount in AED',
          },
          description: {
            type: 'string',
            description: 'Project scope and brief description',
          },
          plannedDuration: {
            type: 'string',
            description: 'Estimated duration (e.g. "8 weeks")',
          },
        },
        required: ['name', 'clientName', 'budgetAmountAED'],
      }),
    },
    async (args: any) => {
      const { name, clientName, budgetAmountAED, description, plannedDuration } = args || {}
      try {
        await connectDB()

        // Resolve author/admin user
        const defaultUser = (await User.findOne({ isSuperAdmin: true })) || (await User.findOne())
        if (!defaultUser) {
          return {
            content: [{ type: 'text', text: 'Cannot create project: No user accounts found in database.' }],
          }
        }

        // Find or create client
        let client = await Client.findOne({ name: new RegExp(`^${String(clientName).trim()}$`, 'i') })
        if (!client) {
          client = await Client.create({
            name: String(clientName).trim(),
            createdBy: defaultUser._id,
          })
        }

        // Generate unique project code
        const slug =
          String(name)
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 15) || 'PROJ'
        let code = `PRJ-${slug}`
        let counter = 1
        while (await Project.exists({ code })) {
          counter++
          code = `PRJ-${slug}-${counter}`
        }

        const project = await Project.create({
          code,
          name: String(name).trim(),
          clientId: client._id,
          description: description ? String(description).trim() : undefined,
          budget: { amount: Math.round(Number(budgetAmountAED) * 100), currency: 'AED' },
          plannedDuration: plannedDuration ? String(plannedDuration).trim() : '8 weeks',
          status: 'active',
          health: 'on_track',
          stages: [
            { name: 'Discovery & Alignment', state: 'active', owner: 'Human Saucer' },
            { name: 'Concept & Delivery', state: 'upcoming', owner: 'Human Saucer' },
            { name: 'Review & Handoff', state: 'upcoming', owner: 'Human Saucer' },
          ],
          activity: [
            {
              occurredOn: new Date(),
              text: `Project initiated via Claude MCP for ${client.name}`,
              pending: false,
            },
          ],
          createdBy: defaultUser._id,
        })

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created project "${project.name}" (Code: ${project.code}) for client ${client.name} with budget AED ${Number(budgetAmountAED).toLocaleString()}.`,
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error creating project: ${err?.message || String(err)}` }],
        }
      }
    },
  )

  return server
}
