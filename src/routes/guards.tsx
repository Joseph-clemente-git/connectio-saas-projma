import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { useSession } from '@/store/session'
import { LoadingScreen } from '@/components/shared/loading-screen'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { validateSession } from '@/lib/auth'

export function RequireAuth() {
  const { isAuthenticated, sessionToken, userId, signOut } = useSession()
  const location = useLocation()
  const authKey = `${userId ?? ''}:${sessionToken ?? ''}`
  const [authCheck, setAuthCheck] = useState<{ key: string; valid: boolean; mustChangePassword: boolean } | null>(null)
  useEffect(() => {
    let cancelled = false
    void validateSession(sessionToken, userId).then(async (user) => {
      if (cancelled) return
      const credential = user ? await db.authCredentials.get(user.id) : undefined
      if (cancelled) return
      setAuthCheck({ key: authKey, valid: Boolean(user), mustChangePassword: user ? credential?.mustChangePassword === true : false })
      if (!user) signOut()
    })
    return () => { cancelled = true }
  }, [authKey, sessionToken, signOut, userId])
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!authCheck || authCheck.key !== authKey) return <LoadingScreen />
  if (!authCheck.valid) return <Navigate to="/login" replace />
  if (authCheck.mustChangePassword && location.pathname !== '/change-password') {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/change-password?next=${encodeURIComponent(next)}`} replace />
  }
  if (!authCheck.mustChangePassword && location.pathname === '/change-password') return <Navigate to="/app" replace />
  return <Outlet />
}

export function AppRootRedirect() {
  const userId = useSession((s) => s.userId)
  const orgId = useSession((s) => s.orgId)
  const destination = useLiveQuery(async () => {
    if (!userId) return '/login'
    const user = await db.users.get(userId)
    if (!user) return '/login'
    if (user.role === 'super_admin') return '/admin/dashboard'
    const memberships = await db.orgMembers.where('userId').equals(userId).toArray()
    if (!memberships.length) return '/onboarding'
    const membership = memberships.find((entry) => entry.orgId === orgId) ?? memberships[0]
    const org = await db.organizations.get(membership.orgId)
    if (!org) return '/onboarding'
    if (membership.role === 'owner' && org.onboardingStep !== 'complete') return '/onboarding'
    return `/app/${org.slug}/dashboard`
  }, [orgId, userId])
  if (!destination) return <LoadingScreen />
  return <Navigate to={destination} replace />
}

/** Financial records are available only to the owner of the current tenant. */
export function RequireOrgOwner() {
  const { orgSlug } = useParams()
  const userId = useSession((s) => s.userId)
  const tenantContext = useOutletContext<TenantOutletContext>()
  const hasAccess = useLiveQuery(async () => {
    if (!orgSlug || !userId) return false
    const org = await db.organizations.where('slug').equals(orgSlug).first()
    if (!org) return false
    const membership = await db.orgMembers.where('[orgId+userId]').equals([org.id, userId]).first()
    return membership?.role === 'owner'
  }, [orgSlug, userId], null)

  if (hasAccess === null) return <LoadingScreen />
  if (!hasAccess) return <Navigate to={`/app/${orgSlug}/settings/org`} replace />
  return <Outlet context={tenantContext} />
}
