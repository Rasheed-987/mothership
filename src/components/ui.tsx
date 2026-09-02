import type { ComponentProps, ReactNode } from 'react'

/** Presentational only — no hooks, so these import cleanly into client and server components alike. */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-6 ${className}`}>
      {children}
    </div>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">
      {children}
    </label>
  )
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={`w-full rounded-field border border-line-2 bg-surface px-3 py-2 text-sm outline-none
        placeholder:text-faint focus:border-ink/40 focus:ring-2 focus:ring-ink/10 ${className}`}
    />
  )
}

export function Select({ className = '', children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={`w-full rounded-field border border-line-2 bg-surface px-3 py-2 text-sm outline-none
        focus:border-ink/40 focus:ring-2 focus:ring-ink/10 ${className}`}
    >
      {children}
    </select>
  )
}

export function Button({ className = '', variant = 'primary', ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-white hover:bg-accent-press',
    ghost: 'border border-line-2 text-ink-2 hover:bg-ink/5',
    danger: 'text-bad hover:bg-bad/10',
  }[variant]

  return (
    <button
      {...props}
      className={`rounded-field px-4 py-2 text-sm font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="mt-1.5 text-xs text-bad">{errors.join(' ')}</p>
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  const styles = {
    error: 'border-bad/30 bg-bad/10 text-bad',
    success: 'border-ok/30 bg-ok/10 text-ok',
    info: 'border-line-2 bg-surface-2 text-ink-2',
  }[tone]
  return <div className={`rounded-field border px-3.5 py-2.5 text-sm ${styles}`}>{children}</div>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' }) {
  const styles = {
    neutral: 'bg-ink/10 text-ink/70',
    green: 'bg-ok/15 text-ok',
    amber: 'bg-warn/15 text-warn',
    red: 'bg-bad/15 text-bad',
  }[tone]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase leading-[.92] tracking-[.01em] text-ink">
          {title}
        </h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
