/**
 * Plain constants shared by server (service, seed) and client (modal, pipeline view).
 * No imports, no directives — safe on both sides of the RSC boundary.
 * Keep the string unions in sync with `src/models/Deal.ts`.
 */

/** DB stage → the label the pipeline UI shows. `lead` reads as "Discussions". */
export const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: 'Discussions',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

/** Stages that count as live pipeline (not closed). */
export const OPEN_DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation'] as const

export const DEAL_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'lead', label: 'Discussions' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export const DEAL_CONFIDENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
]

/** Suggested win probability from stage + confidence. Editable in the form. */
export function suggestProbability(stage: string, confidence: string): number {
  if (stage === 'won') return 100
  if (stage === 'lost') return 0
  if (stage === 'negotiation') return confidence === 'high' ? 70 : 45
  if (stage === 'proposal') return confidence === 'high' ? 50 : 25
  if (stage === 'qualified') return 20
  return 10 // lead / "Discussions"
}

/** The combined status label — "Proposal · high", "Discussions", … */
export function pipeStatusLabel(stage: string, confidence: string): string {
  if (stage === 'proposal') return `Proposal · ${confidence === 'high' ? 'high' : 'low'}`
  return DEAL_STAGE_LABELS[stage] ?? stage
}
