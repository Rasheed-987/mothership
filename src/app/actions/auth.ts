'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/db'
import { audit, clientIp, userAgent } from '@/lib/audit'
import { createSession, destroySession } from '@/lib/auth/session'
import { equalizeTiming, verifyPassword } from '@/lib/auth/password'
import { clearRateLimit, rateLimit } from '@/lib/auth/rate-limit'
import { acceptSchema, acceptInvitation } from '@/lib/services/invitations'
import { ServiceError } from '@/lib/services/roles'
import { User } from '@/models/User'

export type FormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
} | null

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Enter a valid email address.' }),
  password: z.string().min(1, { message: 'Enter your password.' }),
})

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { email, password } = parsed.data
  const ip = await clientIp()

  // Throttle per address *and* per account, so neither a single attacker nor a
  // distributed one gets unlimited guesses at one inbox.
  const limits = [
    rateLimit(`login:ip:${ip ?? 'unknown'}`, 20, 15 * 60_000),
    rateLimit(`login:email:${email}`, 8, 15 * 60_000),
  ]
  const blocked = limits.find((l) => !l.ok)
  if (blocked) {
    return { error: `Too many attempts. Try again in ${Math.ceil(blocked.retryAfterMs / 60_000)} minutes.` }
  }

  await connectDB()
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user) {
    // Hash anyway: without this, an unknown address returns measurably faster
    // than a wrong password and the form becomes a user-enumeration oracle.
    await equalizeTiming(password)
    return { error: 'Invalid email or password.' }
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    await audit({ actorId: user._id, action: 'auth.login_failed', metadata: { email } })
    return { error: 'Invalid email or password.' }
  }

  if (user.status !== 'active') {
    return { error: 'This account has been suspended. Contact your administrator.' }
  }

  clearRateLimit(`login:email:${email}`)
  await createSession(user._id, { ip, userAgent: await userAgent() })
  await audit({ actorId: user._id, action: 'auth.login', metadata: { email } })

  // redirect() throws to unwind, so it must sit outside any try/catch.
  redirect('/dashboard')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/login')
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get('token'),
    name: formData.get('name'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  let userId: string
  try {
    userId = await acceptInvitation(parsed.data)
  } catch (err) {
    if (err instanceof ServiceError) return { error: err.message }
    console.error('[acceptInvite]', err)
    return { error: 'Something went wrong setting up your account. Try again.' }
  }

  // Log them straight in — they have just proved control of the address.
  await createSession(userId, { ip: await clientIp(), userAgent: await userAgent() })
  redirect('/dashboard')
}
