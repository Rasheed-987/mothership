import { requireAuth } from '@/lib/dal'
import ClientsView, { type Client } from './clients-view'

// Frontend-only phase: registry data mirrors the demo's seed projects,
// pre-aggregated per client. Swap for a DB query when the backend lands.
const MOCK_CLIENTS: Client[] = [
  { name: 'One Health', industry: 'Healthcare', projects: 1, active: 1, value: 95000, status: 'Active' },
  { name: 'PureHealth', industry: 'Healthcare', projects: 3, active: 2, value: 450000, status: 'Active' },
  { name: 'GLP', industry: 'Government', projects: 1, active: 1, value: 125000, status: 'Active' },
  { name: 'Zeyra Glow', industry: 'Beauty & Cosmetics', projects: 1, active: 1, value: 19000, status: 'Active' },
  { name: 'Rove Resorts', industry: 'Hospitality', projects: 1, active: 1, value: 80000, status: 'Active' },
  { name: 'Rove', industry: 'Hospitality', projects: 1, active: 0, value: 44000, status: 'Past' },
  { name: 'Department of Finance', industry: 'Government', projects: 1, active: 0, value: 210000, status: 'In pipeline' },
  { name: 'Rafed', industry: 'Healthcare', projects: 1, active: 0, value: 165000, status: 'In pipeline' },
  { name: 'Colorland Toys', industry: 'Retail', projects: 1, active: 0, value: 10500, status: 'In pipeline' },
  { name: 'Al Maryah Community', industry: 'Healthcare', projects: 1, active: 0, value: 90000, status: 'In pipeline' },
  { name: 'Dubai Municipality', industry: 'Government', projects: 1, active: 0, value: 60000, status: 'In pipeline' },
  { name: 'ElephantSkin', industry: 'Sustainable Gloves', projects: 1, active: 0, value: 0, status: 'Lead' },
]

export default async function ClientsPage() {
  await requireAuth()
  return <ClientsView clients={MOCK_CLIENTS} />
}
