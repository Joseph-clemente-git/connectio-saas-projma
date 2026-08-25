import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ShieldCheck, Users, Crown, Eye, FolderKanban } from 'lucide-react'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/shared/pagination'
import { format } from 'date-fns'

export function UsersPage() {
  const users = useLiveQuery(() => db.users.toArray(), [])
  const memberships = useLiveQuery(() => db.orgMembers.toArray(), [])
  const orgs = useLiveQuery(() => db.organizations.toArray(), [])
  const teams = useLiveQuery(() => db.teams.toArray(), [])
  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const rows = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.title?.toLowerCase().includes(q))
      .map((u) => {
        const membership = memberships?.find((m) => m.userId === u.id)
        const org = orgs?.find((o) => o.id === membership?.orgId)
        return { user: u, org, membership }
      })
      .filter(({ user, membership }) => roleFilter === 'all' || (roleFilter === 'super_admin' ? user.role === 'super_admin' : membership?.role === roleFilter))
  }, [users, memberships, orgs, query, roleFilter])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Users" description={`${users?.length ?? 0} users across every organization`} />
      <div className="flex-1 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search users" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Search users…" className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(1) }}>
            <SelectTrigger aria-label="Filter by role" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="super_admin">Super admins</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
              <SelectItem value="admin">Organization admins</SelectItem>
              <SelectItem value="member">Members</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Organization role</th>
                  <th className="px-4 py-3 font-medium">Job title</th>
                  <th className="px-4 py-3 font-medium">Responsibilities</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ user, org, membership }) => {
                  const ledTeams = teams?.filter((team) => team.leadId === user.id) ?? []
                  const ledProjects = projects?.filter((project) => project.leadId === user.id) ?? []
                  const coordinatedProjects = projects?.filter((project) => project.coordinatorId === user.id) ?? []
                  const reviewedProjects = projects?.filter((project) => project.reviewerId === user.id) ?? []
                  return (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={user.name} color={user.avatarColor} className="size-8" />
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {user.role === 'super_admin' ? (
                        <Badge variant="accent" className="gap-1">
                          <ShieldCheck className="size-3" /> Super Admin
                        </Badge>
                      ) : (
                        <Badge variant={membership?.role === 'owner' ? 'accent' : 'secondary'}>
                          {membership?.role ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1) : 'Member'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.title ?? 'Not set'}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {ledTeams.length > 0 && <Badge variant="warning"><Crown className="size-3" /> Leads {ledTeams.length} team{ledTeams.length === 1 ? '' : 's'}</Badge>}
                        {ledProjects.length > 0 && <Badge variant="outline"><FolderKanban className="size-3" /> Leads {ledProjects.length} project{ledProjects.length === 1 ? '' : 's'}</Badge>}
                        {coordinatedProjects.length > 0 && <Badge variant="outline">Coordinates {coordinatedProjects.length} project{coordinatedProjects.length === 1 ? '' : 's'}</Badge>}
                        {reviewedProjects.length > 0 && <Badge variant="secondary"><Eye className="size-3" /> Reviews {reviewedProjects.length} project{reviewedProjects.length === 1 ? '' : 's'}</Badge>}
                        {membership && (membership.role !== 'member' || membership.canReview) && <Badge variant="secondary"><Eye className="size-3" /> Reviewer</Badge>}
                        {ledTeams.length === 0 && ledProjects.length === 0 && coordinatedProjects.length === 0 && reviewedProjects.length === 0 && !(membership && (membership.role !== 'member' || membership.canReview)) && <span className="text-xs text-muted-foreground">Contributor</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(user.createdAt), 'MMM d, yyyy')}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={safePage} pageSize={pageSize} total={rows.length} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState icon={Users} title="No users found" description="Try a different search term." />
        )}
      </div>
    </div>
  )
}
