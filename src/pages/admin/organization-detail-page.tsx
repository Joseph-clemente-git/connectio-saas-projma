import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, ShieldOff, ShieldCheck } from 'lucide-react'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { PlanBadge } from '@/components/shared/plan-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUsage } from '@/hooks/use-session-data'
import { PLAN_ORDER, DEFAULT_PLANS } from '@/lib/plans'
import { limitLabel } from '@/lib/entitlements'
import type { PlanTier } from '@/types/domain'
import { format } from 'date-fns'
import { setOrganizationPlan } from '@/lib/subscriptions'

export function OrganizationDetailPage() {
  const { orgId } = useParams()
  const org = useLiveQuery(() => (orgId ? db.organizations.get(orgId) : undefined), [orgId])
  const owner = useLiveQuery(() => (org ? db.users.get(org.ownerId) : undefined), [org?.ownerId])
  const usage = useOrgUsage(orgId)
  const plan = org?.plan ? DEFAULT_PLANS[org.plan] : undefined

  if (org === undefined) return <LoadingScreen />
  if (!org) {
    return (
      <div className="p-6">
        <EmptyState icon={Building2} title="Organization not found" description="It may have been deleted." />
      </div>
    )
  }

  const usageRows = plan
    ? [
        { label: 'Teams', current: usage?.teams ?? 0, limit: plan.limits.teams },
        { label: 'Members', current: usage?.members ?? 0, limit: plan.limits.members },
        { label: 'Workspaces', current: usage?.workspaces ?? 0, limit: plan.limits.workspaces },
        { label: 'Projects', current: usage?.projects ?? 0, limit: plan.limits.projects },
      ]
    : []

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={
          <Breadcrumbs items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Organizations', to: '/admin/organizations' },
            { label: <span className="text-xl font-bold tracking-tight">{org.name}</span> },
          ]} />
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <InitialsAvatar name={org.name} color={org.logoColor} className="size-14 text-lg" />
              <div>
                <p className="text-lg font-semibold text-foreground">{org.name}</p>
                <p className="text-sm text-muted-foreground">{org.industry} · Created {format(new Date(org.createdAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
            {owner && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <InitialsAvatar name={owner.name} color={owner.avatarColor} className="size-8" />
                <div>
                  <p className="text-sm font-medium text-foreground">{owner.name}</p>
                  <p className="text-xs text-muted-foreground">Owner · {owner.email}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {usageRows.map((row) => {
                const pct = row.limit === null ? 0 : Math.min(100, Math.round((row.current / row.limit) * 100))
                return (
                  <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.label}</span>
                      <span className="text-muted-foreground">
                        {row.current} / {limitLabel(row.limit)}
                      </span>
                    </div>
                    {row.limit !== null && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={pct >= 100 ? 'h-full rounded-full bg-destructive' : 'h-full rounded-full bg-primary'} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
              <CardDescription>Override this org's plan directly.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PlanBadge plan={org.plan} className="w-fit" />
              <Select value={org.plan} onValueChange={(v) => void setOrganizationPlan(org.id, v as PlanTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {DEFAULT_PLANS[tier].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>Suspend to immediately block sign-in for this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              {org.status === 'active' ? (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => db.organizations.update(org.id, { status: 'suspended' })}
                >
                  <ShieldOff className="size-4" /> Suspend organization
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => db.organizations.update(org.id, { status: 'active' })}>
                  <ShieldCheck className="size-4" /> Reactivate organization
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
