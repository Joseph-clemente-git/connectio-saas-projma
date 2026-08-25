import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { Building2, DollarSign, TicketCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanBadge } from '@/components/shared/plan-badge'
import { InitialsAvatar } from '@/components/ui/avatar'
import { usePlatformStats, useAllOrganizations } from '@/hooks/use-admin-data'
import { PLAN_ORDER, DEFAULT_PLANS } from '@/lib/plans'
import { format } from 'date-fns'

export function AdminDashboardPage() {
  const stats = usePlatformStats()
  const orgs = useAllOrganizations()

  const planChartData = stats
    ? PLAN_ORDER.map((tier) => ({ name: DEFAULT_PLANS[tier].name, count: stats.byPlan[tier] }))
    : []

  const recentOrgs = orgs
    ? [...orgs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)
    : []

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Super Admin dashboard" description="Platform-wide metrics across every tenant." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Organizations" value={stats?.totalOrgs ?? 0} icon={Building2} hint={`${stats?.suspendedOrgs ?? 0} suspended`} />
          <StatCard label="Total users" value={stats?.totalUsers ?? 0} icon={Users} accent="accent" />
          <StatCard label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} icon={DollarSign} accent="success" hint="Active subscriptions" />
          <StatCard label="Open tickets" value={stats?.openTickets ?? 0} icon={TicketCheck} accent="warning" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Organizations by plan</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                  <ChartTooltip
                    cursor={{ fill: 'var(--color-muted)' }}
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Newest organizations</CardTitle>
              <Link to="/admin/organizations" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {recentOrgs.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={org.name} color={org.logoColor} className="size-8" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(org.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <PlanBadge plan={org.plan} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
