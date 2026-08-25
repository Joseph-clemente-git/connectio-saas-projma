import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { Building2, CheckCircle2, FolderKanban, Users2 } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/ui/avatar'
import { useOrgUsage } from '@/hooks/use-session-data'
import { limitLabel, usageLabel } from '@/lib/entitlements'
import { formatDistanceToNow } from 'date-fns'

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Intake / backlog',
  todo: 'Ready',
  in_progress: 'Active work',
  in_review: 'Independent review',
  done: 'Approved outcome',
}

export function DashboardPage() {
  const { org, plan } = useOutletContext<TenantOutletContext>()
  const usage = useOrgUsage(org.id)

  const taskStatusData = useLiveQuery(async () => {
    const projects = await db.projects.where('orgId').equals(org.id).toArray()
    const projectIds = new Set(projects.map((p) => p.id))
    const allTasks = await db.tasks.toArray()
    const tasks = allTasks.filter((t) => projectIds.has(t.projectId))
    const counts: Record<string, number> = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0 }
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1
    return Object.entries(counts).map(([status, count]) => ({ status: STATUS_LABEL[status] ?? status, count }))
  }, [org.id])

  const activity = useLiveQuery(
    () => db.auditLogs.where('orgId').equals(org.id).reverse().sortBy('createdAt').then((r) => r.slice(0, 8)),
    [org.id],
  )

  const activeProjects = useLiveQuery(
    () => db.projects.where({ orgId: org.id }).and((p) => p.status === 'active').count(),
    [org.id],
  )

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Dashboard" description={`Live overview of ${org.name}`} />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Teams"
            value={usageLabel(usage?.teams ?? 0, plan.limits.teams)}
            icon={Users2}
            hint={plan.limits.teams !== null ? `of ${limitLabel(plan.limits.teams)} on ${plan.name}` : 'Unlimited'}
          />
          <StatCard
            label="Members"
            value={usageLabel(usage?.members ?? 0, plan.limits.members)}
            icon={Building2}
            accent="accent"
            hint={plan.limits.members !== null ? `of ${limitLabel(plan.limits.members)} on ${plan.name}` : 'Unlimited'}
          />
          <StatCard
            label="Workspaces"
            value={usageLabel(usage?.workspaces ?? 0, plan.limits.workspaces)}
            icon={FolderKanban}
            accent="success"
            hint={plan.limits.workspaces !== null ? `of ${limitLabel(plan.limits.workspaces)}` : 'Unlimited'}
          />
          <StatCard
            label="Reported active"
            value={activeProjects ?? 0}
            icon={CheckCircle2}
            accent="warning"
            hint={`manager-reported · ${usageLabel(usage?.projects ?? 0, plan.limits.projects)} total`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Task evidence across workflows</CardTitle>
              <p className="text-xs text-muted-foreground">Semantic stages are combined here even when individual projects use different stage names.</p>
            </CardHeader>
            <CardContent className="h-72">
              {taskStatusData && taskStatusData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskStatusData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                    <ChartTooltip
                      cursor={{ fill: 'var(--color-muted)' }}
                      contentStyle={{
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No tasks yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {activity && activity.length > 0 ? (
                activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <InitialsAvatar name={log.actorName} className="mt-0.5 size-7 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{log.actorName}</span> {log.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
