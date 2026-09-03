import 'server-only'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { audit } from '@/lib/audit'
import { Client, type ClientStatus } from '@/models/Client'
import { Project } from '@/models/Project'
import type { CurrentUser } from '@/lib/authz'
import { ServiceError } from './roles'
export { ServiceError } from './roles'

export const clientSchema = z.object({
  name: z.string().trim().min(1, { message: 'Client name is required.' }).max(160),
  industry: z.string().trim().max(100).optional().default('—'),
  country: z.string().trim().max(100).optional().default('UAE'),
  contactName: z.string().trim().max(120).optional().default(''),
  contactEmail: z.string().trim().email({ message: 'Enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(50).optional().default(''),
  docs: z.string().trim().max(500).optional().default(''),
  logoUrl: z.string().trim().optional().default(''),
  status: z.enum(['active', 'lead', 'inactive', 'archived']).optional().default('active'),
})

export type CreateClientInput = z.infer<typeof clientSchema>

/** Every field optional — omitted keys are left untouched by updateClient. */
export const updateClientSchema = clientSchema.partial()
export type UpdateClientInput = z.infer<typeof updateClientSchema>

export type ClientDTO = {
  id: string
  name: string
  industry: string
  country: string
  contactName: string
  contactEmail: string
  contactPhone: string
  docs: string
  logoUrl: string
  status: 'Active' | 'In pipeline' | 'Past' | 'Lead'
  dbStatus: ClientStatus
  projectsCount: number
  activeProjectsCount: number
  totalValue: number
  createdAt: string
}

export type ClientProjectDTO = {
  id: string
  projectName: string
  category: string
  status: string
  value: number
}

export type ClientDetailDTO = ClientDTO & {
  projects: ClientProjectDTO[]
  activeProjects: ClientProjectDTO[]
  pipelineProjects: ClientProjectDTO[]
  completedProjects: ClientProjectDTO[]
  lostProjects: ClientProjectDTO[]
}

function mapDisplayStatus(
  dbStatus: ClientStatus,
  activeCount: number,
  pipelineCount: number,
  completedCount: number,
): 'Active' | 'In pipeline' | 'Past' | 'Lead' {
  if (activeCount > 0) return 'Active'
  if (pipelineCount > 0) return 'In pipeline'
  if (completedCount > 0) return 'Past'
  if (dbStatus === 'active') return 'Active'
  if (dbStatus === 'inactive') return 'Past'
  return 'Lead'
}

export async function listClients(): Promise<ClientDTO[]> {
  await connectDB()

  const clients = await Client.find().sort({ name: 1 }).lean()

  // Aggregate project stats per client
  const projects = await Project.find().lean()
  const projectsByClientId = new Map<string, typeof projects>()

  for (const p of projects) {
    const cId = String(p.clientId)
    if (!projectsByClientId.has(cId)) projectsByClientId.set(cId, [])
    projectsByClientId.get(cId)!.push(p)
  }

  return clients.map((c) => {
    const cId = String(c._id)
    const clientProjects = projectsByClientId.get(cId) || []

    let activeCount = 0
    let pipelineCount = 0
    let completedCount = 0
    let totalVal = 0

    for (const p of clientProjects) {
      const pVal = p.budget?.amount ? p.budget.amount / 100 : 0
      if (p.status === 'active' || p.status === 'planning') {
        activeCount++
        totalVal += pVal
      } else if (p.status === 'completed') {
        completedCount++
        totalVal += pVal
      } else if (p.status === 'on_hold') {
        pipelineCount++
        totalVal += pVal
      }
    }

    const primaryContact = c.contacts && c.contacts.length > 0 ? c.contacts[0] : null
    const displayStatus = mapDisplayStatus(c.status, activeCount, pipelineCount, completedCount)

    return {
      id: cId,
      name: c.name,
      industry: c.industry || '—',
      country: c.address?.country || 'UAE',
      contactName: primaryContact?.name || '',
      contactEmail: primaryContact?.email || c.email || '',
      contactPhone: primaryContact?.phone || c.phone || '',
      docs: c.notes || '',
      logoUrl: c.website || '',
      status: displayStatus,
      dbStatus: c.status,
      projectsCount: clientProjects.length,
      activeProjectsCount: activeCount,
      totalValue: totalVal,
      createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    }
  })
}

export async function getClientById(clientId: string): Promise<ClientDetailDTO | null> {
  await connectDB()

  let client = await Client.findById(clientId).lean()
  if (!client) {
    // Lookup by name if not a valid ObjectId
    client = await Client.findOne({ name: clientId }).lean()
  }

  if (!client) return null

  const cId = String(client._id)
  const projects = await Project.find({ clientId: client._id }).sort({ createdAt: -1 }).lean()

  const allProjects: ClientProjectDTO[] = []
  const activeProjects: ClientProjectDTO[] = []
  const pipelineProjects: ClientProjectDTO[] = []
  const completedProjects: ClientProjectDTO[] = []
  const lostProjects: ClientProjectDTO[] = []

  let totalVal = 0

  for (const p of projects) {
    const val = p.budget?.amount ? p.budget.amount / 100 : 0
    const dto: ClientProjectDTO = {
      id: String(p._id),
      projectName: p.name,
      category: p.tags && p.tags.length > 0 ? p.tags[0] : 'General',
      status: p.status,
      value: val,
    }

    allProjects.push(dto)

    if (p.status === 'active' || p.status === 'planning') {
      activeProjects.push(dto)
      totalVal += val
    } else if (p.status === 'on_hold') {
      pipelineProjects.push(dto)
      totalVal += val
    } else if (p.status === 'completed') {
      completedProjects.push(dto)
      totalVal += val
    } else if (p.status === 'cancelled') {
      lostProjects.push(dto)
    }
  }

  const primaryContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : null
  const displayStatus = mapDisplayStatus(
    client.status,
    activeProjects.length,
    pipelineProjects.length,
    completedProjects.length,
  )

  return {
    id: cId,
    name: client.name,
    industry: client.industry || '—',
    country: client.address?.country || 'UAE',
    contactName: primaryContact?.name || '',
    contactEmail: primaryContact?.email || client.email || '',
    contactPhone: primaryContact?.phone || client.phone || '',
    docs: client.notes || '',
    logoUrl: client.website || '',
    status: displayStatus,
    dbStatus: client.status,
    projectsCount: allProjects.length,
    activeProjectsCount: activeProjects.length,
    totalValue: totalVal,
    createdAt: client.createdAt ? client.createdAt.toISOString() : new Date().toISOString(),
    projects: allProjects,
    activeProjects,
    pipelineProjects,
    completedProjects,
    lostProjects,
  }
}

export async function createClient(actor: CurrentUser, input: CreateClientInput) {
  await connectDB()

  const existing = await Client.findOne({ name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') } }).lean()
  if (existing) {
    throw new ServiceError(`“${input.name}” is already in the list — no duplicates allowed.`, 409, 'name')
  }

  const contacts = input.contactName
    ? [
        {
          name: input.contactName,
          email: input.contactEmail || undefined,
          phone: input.contactPhone || undefined,
          isPrimary: true,
        },
      ]
    : []

  const client = await Client.create({
    name: input.name,
    industry: input.industry,
    status: input.status,
    address: { country: input.country },
    email: input.contactEmail || undefined,
    phone: input.contactPhone || undefined,
    website: input.logoUrl || undefined,
    notes: input.docs || undefined,
    contacts,
    createdBy: actor.id,
  })

  await audit({
    actorId: actor.id,
    action: 'client.created',
    targetType: 'Client',
    targetId: String(client._id),
    metadata: { name: client.name },
  })

  return { id: String(client._id), name: client.name }
}

export async function updateClient(actor: CurrentUser, clientId: string, input: UpdateClientInput) {
  await connectDB()

  const client = await Client.findById(clientId)
  if (!client) throw new ServiceError('Client not found.', 404)

  if (input.name && input.name.trim().toLowerCase() !== client.name.toLowerCase()) {
    const existing = await Client.findOne({
      _id: { $ne: clientId },
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
    }).lean()
    if (existing) {
      throw new ServiceError(`“${input.name}” is already in the list — no duplicates allowed.`, 409, 'name')
    }
  }

  if (input.name) client.name = input.name
  if (input.industry !== undefined) client.industry = input.industry
  if (input.country !== undefined) client.address = { ...client.address, country: input.country }
  if (input.docs !== undefined) client.notes = input.docs
  if (input.logoUrl !== undefined) client.website = input.logoUrl
  if (input.status) client.status = input.status as ClientStatus

  if (input.contactName) {
    client.contacts = [
      {
        name: input.contactName,
        email: input.contactEmail || undefined,
        phone: input.contactPhone || undefined,
        isPrimary: true,
      },
    ]
  }

  await client.save()

  await audit({
    actorId: actor.id,
    action: 'client.updated',
    targetType: 'Client',
    targetId: String(client._id),
    metadata: { name: client.name },
  })

  return { id: String(client._id), name: client.name }
}

export async function deleteClient(actor: CurrentUser, clientId: string) {
  await connectDB()

  const client = await Client.findById(clientId)
  if (!client) throw new ServiceError('Client not found.', 404)

  const activeProjects = await Project.countDocuments({ clientId: client._id })
  if (activeProjects > 0) {
    throw new ServiceError(`This client still has ${activeProjects} project(s) — remove or reassign those first.`, 409)
  }

  await client.deleteOne()

  await audit({
    actorId: actor.id,
    action: 'client.deleted',
    targetType: 'Client',
    targetId: clientId,
    metadata: { name: client.name },
  })
}
