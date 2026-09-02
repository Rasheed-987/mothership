'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The black sidebar "rail" from the design reference: 250px, sticky, brand up
 * top, uppercase section labels, stroke-icon nav items with a red active bar,
 * and the signed-in user pinned to the bottom. Below 860px it becomes an
 * off-canvas drawer behind a hamburger topbar.
 */

export type NavItem = {
  href: string
  label: string
  icon: IconName
  section: string
  disabled?: boolean
}

type SidebarUser = { name: string; role: string }

type IconName =
  | 'home'
  | 'users'
  | 'shield'
  | 'briefcase'
  | 'folder'
  | 'dollar'
  | 'tag'
  | 'archive'

// 24px stroke-only outlines, styled via CSS like the reference
// (stroke: currentColor, stroke-width 1.9, round caps/joins).
const ICONS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 13h18" />
    </>
  ),
  folder: (
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2.5 2.5h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.5-1.5-3-1.5-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2c1.8.3 3 1 3 2.3 0 1.4-1.3 2.2-3 2.2-1.5 0-2.5-.5-3-1.5" />
      <path d="M12 6.5v11" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V5A1.5 1.5 0 0 1 5 3.5h7.5L20 11a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" />
    </>
  ),
}

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[18px] w-[18px] shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
    >
      {ICONS[name]}
    </svg>
  )
}

export default function Sidebar({
  items,
  user,
  logoutAction,
}: {
  items: NavItem[]
  user: SidebarUser
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const sections = items.reduce<{ name: string; items: NavItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1]
    if (last?.name === item.section) last.items.push(item)
    else acc.push({ name: item.section, items: [item] })
    return acc
  }, [])

  const rail = (
    <aside
      className={`sticky top-0 flex h-screen flex-col overflow-y-auto bg-black px-4 py-6 text-[#EFEFF2]
        max-[860px]:fixed max-[860px]:left-0 max-[860px]:top-0 max-[860px]:z-[60] max-[860px]:w-[230px]
        max-[860px]:transition-transform max-[860px]:duration-200
        ${open ? '' : 'max-[860px]:-translate-x-full'}`}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex items-center gap-[11px] px-2 pb-[22px] pt-1.5"
        onClick={() => setOpen(false)}
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-accent font-display text-lg font-semibold uppercase text-white">
          M
        </span>
        <span className="font-display text-lg font-semibold uppercase leading-[1.04] tracking-[.06em]">
          Mothership
        </span>
      </Link>

      {/* Nav sections */}
      <nav>
        {sections.map((section) => (
          <div key={section.name}>
            <div className="px-2.5 pb-2 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[.16em] text-[#6b6b6f]">
              {section.name}
            </div>
            {section.items.map((item) =>
              item.disabled ? (
                <span
                  key={item.href}
                  aria-disabled
                  className="flex cursor-default items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium text-[#6b6b6f]"
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                  <span className="ml-auto rounded-full bg-[#1d1d1e] px-2 py-px text-[11px] font-semibold text-[#8a8a8e]">
                    soon
                  </span>
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium
                    transition-colors duration-150
                    ${
                      isActive(item.href)
                        ? 'bg-[#1b1b1c] text-white before:absolute before:-left-4 before:bottom-2 before:top-2 before:w-[3px] before:rounded-r-[3px] before:bg-accent before:content-[""]'
                        : 'text-[#B9BABE] hover:bg-[#161616] hover:text-white'
                    }`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Signed-in user */}
      <div className="mt-2 border-t border-[#1c1c1d] pt-3.5">
        <div className="text-[11px] uppercase tracking-[.06em] text-[#7a7a7e]">{user.role}</div>
        <div className="mt-0.5 text-sm font-semibold text-white">{user.name}</div>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium text-[#B9BABE] transition-colors duration-150 hover:bg-[#161616] hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-[18px] w-[18px] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.9]"
            >
              <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
              <path d="M9 8l-4 4 4 4" />
              <path d="M5 12h11" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile topbar with hamburger */}
      <div className="sticky top-0 z-50 hidden items-center gap-3 border-b border-line bg-canvas/80 px-4 py-2.5 backdrop-blur max-[860px]:flex">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-line-2 bg-surface text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-[18px] w-[18px] fill-none stroke-current [stroke-linecap:round] [stroke-width:1.9]"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="font-display text-base font-semibold uppercase tracking-[.06em] text-ink">
          Mothership
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 min-[861px]:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {rail}
    </>
  )
}
