import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { CircleDollarSign, CreditCard, ReceiptText, Search, TrendingUp } from 'lucide-react'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { PlanBadge } from '@/components/shared/plan-badge'
import { Pagination } from '@/components/shared/pagination'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_PLANS } from '@/lib/plans'
import { formatMoney, paymentStatusVariant } from '@/lib/billing'

export function BillingPage() {
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const [organizations, invoices, payments] = await Promise.all([
      db.organizations.toArray(),
      db.invoices.toArray(),
      db.payments.toArray(),
    ])
    return { organizations, invoices, payments }
  }, [], { organizations: [], invoices: [], payments: [] })
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const rows = useMemo(() => data.organizations.map((org) => {
    const invoices = data.invoices.filter((invoice) => invoice.orgId === org.id)
    const payments = data.payments.filter((payment) => payment.orgId === org.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      org,
      totalPaid: payments.filter((payment) => payment.status === 'succeeded').reduce((sum, payment) => sum + payment.amount, 0),
      outstanding: invoices.filter((invoice) => invoice.status === 'open' || invoice.status === 'overdue').reduce((sum, invoice) => sum + invoice.amount, 0),
      lastPayment: payments[0],
    }
  }), [data])
  const filtered = rows.filter(({ org }) => {
    const normalized = query.trim().toLowerCase()
    return (!normalized || org.name.toLowerCase().includes(normalized) || org.slug.includes(normalized)) && (planFilter === 'all' || org.plan === planFilter)
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const successful = data.payments.filter((payment) => payment.status === 'succeeded')
  const collected = successful.reduce((sum, payment) => sum + payment.amount, 0)
  const outstanding = data.invoices.filter((invoice) => invoice.status === 'open' || invoice.status === 'overdue').reduce((sum, invoice) => sum + invoice.amount, 0)
  const mrr = data.organizations.reduce((sum, org) => sum + (org.status === 'active' && org.plan ? DEFAULT_PLANS[org.plan].monthlyPrice ?? 0 : 0), 0)
  const successRate = data.payments.length ? Math.round((successful.length / data.payments.length) * 100) : 0

  function resetPage(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Revenue & billing" description="Monitor subscriptions, invoices, and payment performance across the platform." />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <section aria-label="Platform billing summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Monthly recurring revenue" value={formatMoney(mrr)} icon={TrendingUp} hint="Active subscriptions" />
          <StatCard label="Collected" value={formatMoney(collected)} icon={CircleDollarSign} hint="All successful payments" accent="success" />
          <StatCard label="Outstanding" value={formatMoney(outstanding)} icon={ReceiptText} hint={outstanding ? 'Across overdue and open invoices' : 'Nothing due'} accent={outstanding ? 'warning' : 'primary'} />
          <StatCard label="Payment success rate" value={`${successRate}%`} icon={CreditCard} hint={`${successful.length} of ${data.payments.length} attempts`} accent={successRate < 90 ? 'warning' : 'success'} />
        </section>

        <section aria-labelledby="org-billing-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="org-billing-title" className="text-lg font-semibold text-foreground">Organization accounts</h2><p className="text-sm text-muted-foreground">Review revenue, balances, and the latest payment for each organization.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative sm:w-72"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search organization billing" value={query} onChange={(event) => resetPage(() => setQuery(event.target.value))} placeholder="Search organizations…" className="pl-9" /></div>
              <Select value={planFilter} onValueChange={(value) => resetPage(() => setPlanFilter(value))}><SelectTrigger aria-label="Filter billing by plan" className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All plans</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="business">Business</SelectItem></SelectContent></Select>
            </div>
          </div>

          {visible.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3 font-medium">Organization</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Total paid</th><th className="px-4 py-3 font-medium">Outstanding</th><th className="px-4 py-3 font-medium">Last payment</th><th className="px-4 py-3 font-medium">Payment status</th></tr></thead>
                  <tbody>{visible.map(({ org, totalPaid, outstanding: due, lastPayment }) => <tr key={org.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><button type="button" className="min-h-11 cursor-pointer text-left hover:text-primary" onClick={() => navigate(`/admin/organizations/${org.id}`)}><span className="block font-medium">{org.name}</span><span className="block text-xs text-muted-foreground">{org.industry}</span></button></td><td className="px-4 py-3"><PlanBadge plan={org.plan} /></td><td className="px-4 py-3 font-medium text-foreground">{formatMoney(totalPaid)}</td><td className="px-4 py-3 font-medium text-foreground">{formatMoney(due)}</td><td className="px-4 py-3 text-muted-foreground">{lastPayment ? format(new Date(lastPayment.createdAt), 'MMM d, yyyy') : 'No payment'}</td><td className="px-4 py-3">{lastPayment ? <Badge variant={paymentStatusVariant(lastPayment.status)}>{lastPayment.status}</Badge> : <Badge variant="secondary">not charged</Badge>}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="divide-y divide-border md:hidden">{visible.map(({ org, totalPaid, outstanding: due, lastPayment }) => <button type="button" key={org.id} className="flex min-h-11 w-full cursor-pointer flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30" onClick={() => navigate(`/admin/organizations/${org.id}`)}><div className="flex w-full items-start justify-between gap-3"><div><p className="font-medium text-foreground">{org.name}</p><p className="text-xs text-muted-foreground">Paid {formatMoney(totalPaid)} · Due {formatMoney(due)}</p></div><PlanBadge plan={org.plan} /></div><div className="flex w-full items-center justify-between text-xs text-muted-foreground"><span>{lastPayment ? format(new Date(lastPayment.createdAt), 'MMM d, yyyy') : 'No payment yet'}</span>{lastPayment ? <Badge variant={paymentStatusVariant(lastPayment.status)}>{lastPayment.status}</Badge> : <Badge variant="secondary">not charged</Badge>}</div></button>)}</div>
              <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
            </div>
          ) : <EmptyState icon={ReceiptText} title="No billing records found" description="Try another organization name or plan." />}
        </section>
      </div>
    </div>
  )
}
