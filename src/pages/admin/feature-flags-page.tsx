import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flag, Search } from 'lucide-react'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination } from '@/components/shared/pagination'

export function FeatureFlagsPage() {
  const flags = useLiveQuery(() => db.featureFlags.toArray(), [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (flags ?? []).filter((flag) =>
      (!q || flag.name.toLowerCase().includes(q) || flag.description.toLowerCase().includes(q)) &&
      (status === 'all' || (status === 'enabled') === flag.enabled),
    )
  }, [flags, query, status])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleFlags = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const enabledCount = flags?.filter((flag) => flag.enabled).length ?? 0

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Feature flags" description="Roll platform-wide features out gradually, independent of plan gating." />
      <div className="flex-1 p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
            <TabsList aria-label="Feature flag status">
              <TabsTrigger value="all">All <span className="text-xs text-muted-foreground">{flags?.length ?? 0}</span></TabsTrigger>
              <TabsTrigger value="enabled">Enabled <span className="text-xs text-muted-foreground">{enabledCount}</span></TabsTrigger>
              <TabsTrigger value="disabled">Disabled <span className="text-xs text-muted-foreground">{(flags?.length ?? 0) - enabledCount}</span></TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full lg:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search feature flags" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search feature flags…" className="pl-9" />
          </div>
        </div>
        {visibleFlags.length > 0 ? (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {visibleFlags.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{flag.name}</p>
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
                </div>
                <Switch aria-label={`${flag.name}: ${flag.enabled ? 'enabled' : 'disabled'}`} checked={flag.enabled} onCheckedChange={(v) => db.featureFlags.update(flag.id, { enabled: v })} />
              </div>
            ))}
            <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        ) : (
          <Card>
            <CardContent className="py-10">
              <EmptyState icon={Flag} title="No feature flags found" description={flags?.length ? 'Try a different search or status.' : 'Nothing configured yet.'} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
