import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldOff } from 'lucide-react'
import { useOrgBySlug, useCurrentUser, usePlanConfig } from '@/hooks/use-session-data'
import { useSession } from '@/store/session'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar } from '@/components/shared/topbar'
import { UpgradeDialog } from '@/components/shared/upgrade-dialog'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { Button } from '@/components/ui/button'
import type { Organization, User } from '@/types/domain'
import type { PlanConfig } from '@/lib/plans'
import { processDueRecurringReports } from '@/lib/recurring-reports'
import { db } from '@/db/schema'

export interface TenantOutletContext {
  org: Organization
  user: User
  plan: PlanConfig
}

export function TenantAppLayout() {
  const { orgSlug } = useParams()
  const { org, status } = useOrgBySlug(orgSlug)
  const switchOrg = useSession((s) => s.switchOrg)
  const user = useCurrentUser()
  const plan = usePlanConfig(org?.plan)
  const membership = useLiveQuery(
    () => (org?.id && user?.id ? db.orgMembers.where('[orgId+userId]').equals([org.id, user.id]).first() : undefined),
    [org?.id, user?.id],
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (org) switchOrg(org.id)
  }, [org?.id, switchOrg])

  useEffect(() => {
    if (!org) return
    void processDueRecurringReports(org.id)
    const interval = window.setInterval(() => void processDueRecurringReports(org.id), 60_000)
    return () => window.clearInterval(interval)
  }, [org?.id])

  if (status === 'not-found') return <Navigate to="/app" replace />
  if (status === 'loading' || !org || !user || membership === undefined) return <LoadingScreen />
  if (!membership) return <Navigate to="/app" replace />
  if (org.onboardingStep !== 'complete' || !org.plan) return <Navigate to={membership.role === 'owner' ? '/onboarding' : '/app'} replace />
  if (!plan) return <LoadingScreen />

  if (org.status === 'suspended') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldOff className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{org.name} has been suspended</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            A Super Admin suspended access to this organization. Contact support if you believe this is a mistake.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            useSession.getState().signOut()
            window.location.href = '/login'
          }}
        >
          Back to login
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden lg:block">
        <Sidebar plan={plan} orgId={org.id} userId={user.id} />
      </div>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar plan={plan} orgId={org.id} userId={user.id} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar org={org} user={user} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet context={{ org, user, plan } satisfies TenantOutletContext} />
        </main>
      </div>
      <UpgradeDialog />
    </div>
  )
}
