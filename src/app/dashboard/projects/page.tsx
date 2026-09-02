import { requireAuth } from '@/lib/dal'
import ProjectsView, { type Project } from './projects-view'

// Frontend-only phase: the repository mirrors the demo's seed projects.
// Swap for a DB query when the backend lands.
const MOCK_PROJECTS: Project[] = [
  { id: 'p-oh-web', client: 'One Health', projectName: 'Web Design & Development', status: '5. In Progress', value: 95000, category: 'Web Design & Development' },
  { id: 'p-seha', client: 'PureHealth', projectName: 'Brand Uplift for SEHA Hospitals', status: '5. In Progress', value: 200000, category: 'Branding', liveStatus: 'Behind', daysBehind: 6 },
  { id: 'p-glp', client: 'GLP', projectName: 'Web Design & Development', status: '5. In Progress', value: 125000, category: 'Web Design & Development' },
  { id: 'p-long', client: 'PureHealth', projectName: 'Longevity Clinic Branding', status: '5. In Progress', value: 125000, category: 'Branding' },
  { id: 'p-zeyra', client: 'Zeyra Glow', projectName: 'Web Design & Development', status: '5. In Progress', value: 19000, category: 'Web Design & Development' },
  { id: 'p-rove2', client: 'Rove Resorts', projectName: 'Web Design & Development', status: '4. Not Yet Started', value: 80000, category: 'Web Design & Development' },
  { id: 'p-onehb', client: 'PureHealth', projectName: 'OneHealth Branding', status: '6. Completed', value: 125000, category: 'Branding' },
  { id: 'p-rove', client: 'Rove', projectName: 'Rove Home Brand Guidelines', status: '6. Completed', value: 44000, category: 'Branding' },
  { id: 'p-dof', client: 'Department of Finance', projectName: 'Web Design & Development', status: '2. Proposal', value: 210000, category: 'Web Design & Development', proposalConfidence: 'High' },
  { id: 'p-rafed', client: 'Rafed', projectName: 'Branding Guidelines', status: '2. Proposal', value: 165000, category: 'Branding', proposalConfidence: 'Low' },
  { id: 'p-color', client: 'Colorland Toys', projectName: 'Social Media Management', status: '2. Proposal', value: 10500, category: 'Social Media', proposalConfidence: 'Low' },
  { id: 'p-alm', client: 'Al Maryah Community', projectName: 'Web Design & Development', status: '1. Discussions', value: 90000, category: 'Web Design & Development', proposalConfidence: 'High' },
  { id: 'p-dm', client: 'Dubai Municipality', projectName: 'Branding Identity', status: '1. Discussions', value: 60000, category: 'Branding', proposalConfidence: 'Low' },
  { id: 'p-eskin', client: 'ElephantSkin', projectName: 'B2B Marketing', status: '7. Rejected / Lost', value: 9000, category: 'Marketing', proposalConfidence: 'Low' },
]

export default async function ProjectsPage() {
  await requireAuth()
  return <ProjectsView projects={MOCK_PROJECTS} />
}
