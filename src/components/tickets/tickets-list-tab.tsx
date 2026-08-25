import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNow } from 'date-fns'
import { Ticket as TicketIcon, Globe } from 'lucide-react'
import { db } from '@/db/schema'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgMembersWithUsers } from '@/hooks/use-session-data'
import {
  TICKET_PRIORITY_DOT, TICKET_PROCESS_LABEL, TICKET_PROCESS_VARIANT, ticketProcessStatus,
} from '@/lib/ticket-ui'
import type { TicketProcessStatus } from '@/lib/ticket-ui'

export function TicketsListTab({ orgId, orgSlug, projectId }: { orgId: string; orgSlug: string; projectId?: string }) {
  const navigate = useNavigate()
  const tickets = useLiveQuery(() => db.tickets.where('orgId').equals(orgId).reverse().sortBy('createdAt'), [orgId])
  const categories = useLiveQuery(() => db.ticketCategories.where('orgId').equals(orgId).toArray(), [orgId])
  const projects = useLiveQuery(() => db.projects.where('orgId').equals(orgId).toArray(), [orgId])
  const members = useOrgMembersWithUsers(orgId)
  const [processFilter, setProcessFilter] = useState<'all' | TicketProcessStatus>('all')
  const [projectFilter, setProjectFilter] = useState('all')

  const scoped = useMemo(
    () => (tickets && projectId ? tickets.filter((t) => t.projectId === projectId) : tickets),
    [tickets, projectId],
  )

  const filtered = useMemo(() => {
    if (!scoped) return []
    return scoped.filter(
      (ticket) => (processFilter === 'all' || ticketProcessStatus(ticket) === processFilter) && (projectFilter === 'all' || ticket.projectId === projectFilter),
    )
  }, [scoped, processFilter, projectFilter])

  if (!tickets) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={processFilter} onValueChange={(value) => setProcessFilter(value as 'all' | TicketProcessStatus)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All process states</SelectItem>
              {Object.entries(TICKET_PROCESS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!projectId && projects && projects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} ticket{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ticket</th>
                <th className="px-4 py-3 font-medium">Process status</th>
                {!projectId && <th className="px-4 py-3 font-medium">Project</th>}
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const category = categories?.find((c) => c.id === t.categoryId)
                const assignee = members?.find((m) => m.user.id === t.assigneeId)?.user
                const project = projects?.find((p) => p.id === t.projectId)
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => navigate(`/app/${orgSlug}/tickets/${t.id}`)}
                  >
                    <td className="max-w-xs px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${TICKET_PRIORITY_DOT[t.priority]}`} />
                        <span className="truncate font-medium text-foreground">{t.subject}</span>
                        {t.source === 'portal' && <Globe className="size-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={TICKET_PROCESS_VARIANT[ticketProcessStatus(t)]}>{TICKET_PROCESS_LABEL[ticketProcessStatus(t)]}</Badge>
                    </td>
                    {!projectId && (
                      <td className="px-4 py-3">
                        {project ? (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
                            {project.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {category ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <InitialsAvatar name={assignee.name} color={assignee.avatarColor} className="size-6" />
                          <span className="text-foreground">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={TicketIcon} title="No tickets" description="Requests from your clients or logged by your team will show up here." />
      )}
    </div>
  )
}
