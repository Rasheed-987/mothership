import { notFound } from 'next/navigation'
import { requireAuth, can } from '@/lib/dal'
import { getClientById } from '@/lib/services/clients'
import ClientDetailView from './client-detail-view'

interface ClientDetailPageProps {
  params: {
    id: string
  }
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requireAuth()

  const client = await getClientById(params.id)
  if (!client) {
    notFound()
  }

  const canEdit = await can('client.update')

  return <ClientDetailView client={client} canEdit={canEdit} />
}
