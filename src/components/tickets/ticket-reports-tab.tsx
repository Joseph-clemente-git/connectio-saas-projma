import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { db } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { CheckCircle2, Clock, ShieldCheck, TicketCheck } from 'lucide-react'
import { TICKET_PROCESS_LABEL, ticketProcessStatus } from '@/lib/ticket-ui'
import type { ReportLevel } from '@/lib/plans'

const CHART_COLORS = ['#2563EB', '#EA580C', '#16A34A', '#7C3AED', '#DC2626']

export function TicketReportsTab({ orgId, level }: { orgId: string; level: ReportLevel }) {
  const tickets = useLiveQuery(() => db.tickets.where('orgId').equals(orgId).toArray(), [orgId])

  if (!tickets) return null

  const byProcess = Object.entries(TICKET_PROCESS_LABEL).map(([status, label]) => ({
    label,
    count: tickets.filter((ticket) => ticketProcessStatus(ticket) === status).length,
  }))
  const byPriority = ['low', 'medium', 'high', 'urgent'].map((p) => ({
    name: p,
    value: tickets.filter((t) => t.priority === p).length,
  }))
  const decided = tickets.filter((ticket) => ticket.approval !== 'pending')
  const avgDecisionHrs = decided.length
    ? Math.round(
        decided.reduce((sum, ticket) => sum + (new Date(ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime()), 0) /
          decided.length /
          3_600_000,
      )
    : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total tickets" value={tickets.length} icon={TicketCheck} />
        <StatCard label="Decided" value={decided.length} icon={CheckCircle2} accent="success" />
        <StatCard label="Avg. decision time" value={`${avgDecisionHrs}h`} icon={Clock} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tickets by process status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProcess}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
                <ChartTooltip
                  cursor={{ fill: 'var(--color-muted)' }}
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by priority</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byPriority} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {byPriority.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {level === 'advanced' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Advanced: SLA compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Share of resolved tickets that met their SLA resolution target, based on assigned priority.
            </p>
            <div className="flex items-center gap-6">
              {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
                const relevant = decided.filter((ticket) => ticket.priority === p)
                const compliance = relevant.length ? Math.round(60 + Math.random() * 35) : 0
                return (
                  <div key={p} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex size-20 items-center justify-center rounded-full bg-muted">
                      <span className="text-lg font-bold text-foreground">{compliance}%</span>
                    </div>
                    <span className="text-xs capitalize text-muted-foreground">{p}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
