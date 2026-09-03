import { requireAuth, can } from '@/lib/dal'
import { listClients } from '@/lib/services/clients'
import ClientsView from './clients-view'

export default async function ClientsPage() {
  await requireAuth()

  const clients = await listClients()
  const canCreate = await can('client.create')
  const canEdit = await can('client.update')

  return <ClientsView clients={clients} canCreate={canCreate} canEdit={canEdit} />
}
