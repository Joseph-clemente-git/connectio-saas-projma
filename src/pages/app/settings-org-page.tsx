import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { PlanBadge } from '@/components/shared/plan-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { db } from '@/db/schema'
import { useOrgUsage } from '@/hooks/use-session-data'
import { limitLabel } from '@/lib/entitlements'
import { RecurringReportsPanel } from '@/components/shared/recurring-reports-panel'
import { useOrgMemberRole } from '@/hooks/use-session-data'
import { canManageOrg } from '@/lib/permissions'

export function SettingsOrgPage() {
  const { org, plan, user } = useOutletContext<TenantOutletContext>()
  const usage = useOrgUsage(org.id)
  const [name, setName] = useState(org.name)
  const [saved, setSaved] = useState(false)
  const membership = useOrgMemberRole(org.id, user.id)

  async function save() {
    if (!name.trim()) return
    await db.organizations.update(org.id, { name: name.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const usageRows = [
    { label: 'Teams', current: usage?.teams ?? 0, limit: plan.limits.teams },
    { label: 'Members', current: usage?.members ?? 0, limit: plan.limits.members },
    { label: 'Workspaces', current: usage?.workspaces ?? 0, limit: plan.limits.workspaces },
    { label: 'Projects', current: usage?.projects ?? 0, limit: plan.limits.projects },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Organization settings" description="Manage details and view plan usage." />
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic information about your organization.</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={!name.trim()}>
                Save changes
              </Button>
              {saved && <span className="text-sm text-success">Saved</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Plan &amp; usage</CardTitle>
              <CardDescription>Current plan and how much of it you're using.</CardDescription>
            </div>
            <PlanBadge plan={org.plan} className="text-sm" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                      <div
                        className={pct >= 100 ? 'h-full rounded-full bg-destructive' : 'h-full rounded-full bg-primary'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report delivery</CardTitle>
            <CardDescription>Create and manage scheduled workspace or project reports.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RecurringReportsPanel orgId={org.id} scope="workspace" canManage={canManageOrg(membership)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
