import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'

export default async function Home() {
  // proxy.ts can only see whether a cookie exists; this verifies it properly.
  const user = await getCurrentUser()
  redirect(user ? '/dashboard' : '/login')
}
