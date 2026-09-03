/** Formatting + avatar helpers ported from the design reference app. */

export function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Rotating avatar tints (.cav.a0–.a4) keyed by the demo's string hash so each
// client keeps the same color everywhere.
const AV_TINTS = [
  'bg-[rgba(255,65,54,.12)] text-[#D8281C]',
  'bg-[rgba(44,107,255,.12)] text-[#2C6BFF]',
  'bg-[rgba(30,158,106,.13)] text-[#168A5B]',
  'bg-[rgba(124,92,255,.13)] text-[#6B4FE6]',
  'bg-[rgba(217,131,31,.15)] text-[#C2741A]',
]
export function avTint(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AV_TINTS[h % 5]
}

/** AED 12,500 style. */
export function aed(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '—'
  return 'AED ' + Math.round(n).toLocaleString('en-US')
}

/** AED 1.2M / AED 95K style; em-dash for nothing. */
export function aedShort(n: number) {
  if (!n) return '—'
  if (Math.abs(n) >= 1e6) return `AED ${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 1e3) return `AED ${Math.round(n / 1e3)}K`
  return `AED ${Math.round(n)}`
}

/** 24 Jun 2026 style. Accepts an ISO string or Date; em-dash for nothing. */
export function fmtDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', opts)
}

/** 24 June style — day + full month, no year. */
export function fmtDay(value: string | Date | null | undefined) {
  return fmtDate(value, { day: 'numeric', month: 'long' })
}

/** 31 July 2026 style — for the "Target launch" hero. */
export function fmtLong(value: string | Date | null | undefined) {
  return fmtDate(value, { day: 'numeric', month: 'long', year: 'numeric' })
}

