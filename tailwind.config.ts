import type { Config } from 'tailwindcss'

/**
 * Tailwind 3 uses a JS config file. (Tailwind 4 replaced this with CSS-first
 * `@theme` blocks in globals.css — see git history if you ever move back.)
 *
 * Palette and type ramp come from the client's design reference
 * (`index (1).html`): light warm-grey canvas, white surfaces, one red accent,
 * Tusker Grotesk display over IBM Plex Sans body.
 */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
        },
        body: 'var(--body)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line2)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          press: 'var(--accent-press)',
          tint: 'var(--accent-tint)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        info: 'var(--info)',
      },
      borderRadius: {
        card: '16px',
        field: '11px',
      },
      fontFamily: {
        display: ['Tusker Grotesk', 'Arial Narrow', 'Impact', 'sans-serif'],
        sans: [
          'IBM Plex Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
