import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PlanBadge } from '@/components/shared/plan-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/shared/pagination'
import { useAllOrganizations, useOrgUsageMap } from '@/hooks/use-admin-data'
import { format } from 'date-fns'

export function OrganizationsPage() {
  const navigate = useNavigate()
  const orgs = useAllOrganizations()
  const usageMap = useOrgUsageMap()
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const filtered = useMemo(() => {
    if (!orgs) return []
    const q = query.trim().toLowerCase()
    return orgs.filter((o) =>
      (!q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)) &&
      (planFilter === 'all' || o.plan === planFilter) &&
      (statusFilter === 'all' || o.status === statusFilter),
    )
  }, [orgs, query, planFilter, statusFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function updateFilters(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Organizations" description={`${orgs?.length ?? 0} tenants on the platform`} />
      <div className="flex-1 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search organizations" value={query} onChange={(e) => updateFilters(() => setQuery(e.target.value))} placeholder="Search organizations…" className="pl-9" />
          </div>
          <Select value={planFilter} onValueChange={(value) => updateFilters(() => setPlanFilter(value))}>
            <SelectTrigger aria-label="Filter by plan" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => updateFilters(() => setStatusFilter(value))}>
            <SelectTrigger aria-label="Filter by status" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Usage</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((org) => {
                  const usage = usageMap?.[org.id]
                  return (
                    <tr
                      key={org.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                      onClick={() => navigate(org.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={org.name} color={org.logoColor} className="size-8" />
                          <div>
                            <p className="font-medium text-foreground">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.industry}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={org.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={org.status === 'active' ? 'success' : 'destructive'}>{org.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {usage ? `${usage.members} members · ${usage.projects} projects` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(org.createdAt), 'MMM d, yyyy')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState icon={Building2} title="No organizations found" description="Try a different search term." />
        )}
      </div>
    </div>
  )
}
