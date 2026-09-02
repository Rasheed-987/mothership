import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in · Mothership' }

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Mothership</h1>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">Sign in to your workspace.</p>
        </div>

        <LoginForm />

        <p className="mt-6 text-xs text-black/45 dark:text-white/45">
          Accounts are created by invitation. Ask your administrator for a link.
        </p>
      </div>
    </main>
  )
}
