import { useLiveQuery } from 'dexie-react-hooks'
import { useOutletContext } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { Activity, Check, CreditCard, DollarSign, LockKeyhole, ReceiptText, WalletCards } from 'lucide-react'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { db } from '@/db/schema'
import { PLAN_ORDER, DEFAULT_PLANS } from '@/lib/plans'
import { limitLabel } from '@/lib/entitlements'
import { formatMoney, invoiceStatusVariant, paymentStatusVariant } from '@/lib/billing'
import { cn } from '@/lib/utils'
import { setOrganizationPlan } from '@/lib/subscriptions'

export function SettingsBillingPage() {
  const { org, user } = useOutletContext<TenantOutletContext>()
  const invoices = useLiveQuery(
    () => db.invoices.where('orgId').equals(org.id).reverse().sortBy('issuedAt'),
    [org.id],
    [],
  )
  const payments = useLiveQuery(
    () => db.payments.where('orgId').equals(org.id).reverse().sortBy('createdAt'),
    [org.id],
    [],
  )
  const billingEvents = useLiveQuery(
    () => db.billingEvents.where('orgId').equals(org.id).reverse().sortBy('createdAt'),
    [org.id],
    [],
  )
  if (!org.plan) return null
  const plan = DEFAULT_PLANS[org.plan]
  const monthlyPrice = plan.monthlyPrice ?? 0
  const successfulPayments = payments.filter((payment) => payment.status === 'succeeded')
  const totalPaid = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const outstanding = invoices.filter((invoice) => invoice.status === 'open' || invoice.status === 'overdue').reduce((sum, invoice) => sum + invoice.amount, 0)
  const latestInvoice = invoices[0]
  const nextBillingDate = monthlyPrice <= 0
    ? 'Not scheduled'
    : latestInvoice
      ? format(addDays(new Date(latestInvoice.periodEnd), 1), 'MMM d, yyyy')
      : 'Upcoming'

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Plan & billing"
        description={`Manage the subscription, invoices, and payment history for ${org.name}.`}
        actions={<Badge variant="outline"><LockKeyhole aria-hidden="true" className="size-3" /> Owner only</Badge>}
      />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <section aria-label="Plan and billing summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Current plan" value={plan.name} icon={WalletCards} hint={`${formatMoney(monthlyPrice)} per month`} />
          <StatCard label="Next billing date" value={nextBillingDate} icon={CreditCard} hint={monthlyPrice > 0 ? 'Automatic renewal' : 'Free plan'} />
          <StatCard label="Total paid" value={formatMoney(totalPaid)} icon={DollarSign} hint={`${successfulPayments.length} successful payments`} accent="success" />
          <StatCard label="Outstanding" value={formatMoney(outstanding)} icon={ReceiptText} hint={outstanding > 0 ? 'Action may be required' : 'Nothing due'} accent={outstanding > 0 ? 'warning' : 'primary'} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Subscription plan</CardTitle>
            <CardDescription>Changes take effect immediately in this demo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {PLAN_ORDER.map((tier) => {
              const option = DEFAULT_PLANS[tier]
              const current = org.plan === tier
              return (
                <div key={tier} className={cn('flex flex-col rounded-xl border border-border p-4', current && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{option.name}</h3>
                      <p className="mt-1 text-2xl font-bold text-foreground">{formatMoney(option.monthlyPrice ?? 0)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                    </div>
                    {current && <Badge>Current</Badge>}
                  </div>
                  <ul className="my-4 flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> {limitLabel(option.limits.members)} members</li>
                    <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> {limitLabel(option.limits.projects)} projects</li>
                    <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-primary" /> {option.limits.storageGb} GB storage</li>
                  </ul>
                  <Button variant={current ? 'outline' : 'accent'} disabled={current} onClick={() => void setOrganizationPlan(org.id, tier, user.name)}>
                    {current ? 'Current plan' : tier === 'free' ? 'Switch to Free' : `Switch to ${option.name}`}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Tabs defaultValue="invoices">
          <Card className="overflow-hidden">
            <CardHeader className="gap-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Billing records</CardTitle>
                <CardDescription>Review invoices and payment activity for this organization.</CardDescription>
              </div>
              <TabsList aria-label="Billing records" className="grid min-h-11 w-full grid-cols-3 sm:w-auto">
                <TabsTrigger value="invoices" className="min-h-9 px-3 sm:min-w-36">
                  <ReceiptText aria-hidden="true" className="size-4" />
                  Invoices
                  <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums">{invoices.length}</span>
                </TabsTrigger>
                <TabsTrigger value="payments" className="min-h-9 px-3 sm:min-w-44">
                  <CreditCard aria-hidden="true" className="size-4" />
                  Payments
                  <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums">{payments.length}</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="min-h-9 px-3 sm:min-w-36">
                  <Activity aria-hidden="true" className="size-4" />
                  Activity
                  <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums">{billingEvents.length}</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="invoices" className="mt-0">
              <CardContent className="p-0">
                {invoices.length ? (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-6 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Issued</th><th className="px-4 py-3 font-medium">Billing period</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-6 py-3 text-right font-medium">Status</th></tr></thead>
                        <tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-border last:border-0"><td className="px-6 py-3 font-medium text-foreground">{invoice.number}</td><td className="px-4 py-3 text-muted-foreground">{format(new Date(invoice.issuedAt), 'MMM d, yyyy')}</td><td className="px-4 py-3 text-muted-foreground">{format(new Date(invoice.periodStart), 'MMM d')} – {format(new Date(invoice.periodEnd), 'MMM d, yyyy')}</td><td className="px-4 py-3 font-medium text-foreground">{formatMoney(invoice.amount, invoice.currency)}</td><td className="px-6 py-3 text-right"><Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge></td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="divide-y divide-border md:hidden">{invoices.map((invoice) => <div key={invoice.id} className="flex items-start justify-between gap-4 p-4"><div><p className="font-medium text-foreground">{invoice.number}</p><p className="mt-1 text-xs text-muted-foreground">Issued {format(new Date(invoice.issuedAt), 'MMM d, yyyy')}</p></div><div className="text-right"><p className="font-semibold text-foreground">{formatMoney(invoice.amount)}</p><Badge className="mt-1" variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge></div></div>)}</div>
                  </>
                ) : <EmptyState icon={ReceiptText} title="No invoices yet" description="Invoices will appear here when this organization is charged." />}
              </CardContent>
            </TabsContent>

            <TabsContent value="payments" className="mt-0">
              <CardContent className="p-0">
                {payments.length ? <div className="divide-y divide-border">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><CreditCard aria-hidden="true" className="size-5" /></div><div><p className="font-medium text-foreground">{payment.methodBrand} ending in {payment.methodLast4}</p><p className="text-xs text-muted-foreground">{format(new Date(payment.createdAt), 'MMM d, yyyy · h:mm a')}</p></div></div><div className="flex items-center justify-between gap-4 pl-[3.25rem] sm:justify-end sm:pl-0"><span className="font-semibold text-foreground">{formatMoney(payment.amount)}</span><Badge variant={paymentStatusVariant(payment.status)}>{payment.status}</Badge></div></div>)}</div> : <EmptyState icon={CreditCard} title="No payments yet" description="Payment attempts will appear here after the first charge." />}
              </CardContent>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <CardContent className="p-0">
                {billingEvents.length ? (
                  <ol className="divide-y divide-border" aria-label="Billing lifecycle activity">
                    {billingEvents.map((event) => (
                      <li key={event.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{event.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.event.replaceAll('.', ' ')} · {format(new Date(event.createdAt), 'MMM d, yyyy · h:mm a')}
                          </p>
                        </div>
                        <Badge className="w-fit shrink-0" variant={event.status === 'failed' ? 'destructive' : event.status === 'pending' ? 'warning' : event.status === 'succeeded' ? 'success' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                ) : <EmptyState icon={Activity} title="No billing activity yet" description="Registration, subscription, invoice, and payment events will appear here." />}
              </CardContent>
            </TabsContent>
          </Card>
        </Tabs>
      </div>
    </div>
  )
}
