/**
 * Plain constants shared by server (service, seed) and client (modal, list view).
 * No imports, no directives — safe on both sides of the RSC boundary.
 * Keep the string unions in sync with `src/models/Project.ts`.
 */

/** Engagement category — stored as the first entry of `Project.tags`. */
export const PROJECT_CATEGORIES = [
  'Branding',
  'Web Design & Development',
  'Social Media',
  'Animation & Video',
  'Marketing',
  'Creative',
] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

/** Lifecycle status → human label for the list/detail chips. */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  active: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PROJECT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PROJECT_HEALTH_OPTIONS: { value: string; label: string }[] = [
  { value: 'on_track', label: 'On track' },
  { value: 'behind', label: 'Behind schedule' },
]

export const STAGE_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'active', label: 'In progress' },
  { value: 'upcoming', label: 'Upcoming' },
]

export const RESOURCE_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: 'drive', label: 'Google Drive' },
  { value: 'figma', label: 'Figma' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'other', label: 'Other' },
]

/** Client business-size tier. Keep in sync with CLIENT_TIERS in src/models/shared.ts. */
export const TIER_LABELS: Record<string, string> = {
  small: 'Small business',
  medium: 'Medium business',
  large: 'Large corporate',
}
export const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: 'small', label: 'Small business' },
  { value: 'medium', label: 'Medium business' },
  { value: 'large', label: 'Large corporate' },
]
