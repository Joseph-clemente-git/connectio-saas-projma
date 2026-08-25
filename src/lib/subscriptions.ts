import { db } from '@/db/schema'
import type { Invoice, PlanTier } from '@/types/domain'

/** Updates the tenant's subscription reference and compatibility plan pointer together. */
export async function setOrganizationPlan(orgId: string, planId: PlanTier, actorName = 'Platform administrator'): Promise<void> {
  const plan = await db.planConfigs.get(planId)
  if (!plan) throw new Error('This plan is no longer available.')
  const organization = await db.organizations.get(orgId)
  if (!organization) throw new Error('Organization not found.')
  const existing = await db.subscriptions.where('orgId').equals(orgId).first()
  if (existing?.planId === planId && organization.plan === planId) return
  const now = new Date().toISOString()
  const correlationId = crypto.randomUUID()
  const amount = plan.monthlyPrice ?? 0
  const invoice: Invoice | undefined = amount > 0 ? {
    id: crypto.randomUUID(),
    orgId,
    number: `INV-${new Date(now).getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    periodStart: now,
    periodEnd: new Date(Date.parse(now) + 30 * 86_400_000).toISOString(),
    issuedAt: now,
    dueAt: new Date(Date.parse(now) + 7 * 86_400_000).toISOString(),
    amount,
    currency: 'USD',
    status: 'open',
  } : undefined

  await db.transaction('rw', [db.organizations, db.subscriptions, db.invoices, db.billingEvents, db.auditLogs], async () => {
    if (existing) {
      await db.subscriptions.update(existing.id, { planId, status: 'active', updatedAt: now })
    } else {
      await db.subscriptions.add({ id: crypto.randomUUID(), orgId, planId, status: 'active', startedAt: now, updatedAt: now })
    }
    await db.organizations.update(orgId, { plan: planId })
    await db.billingEvents.bulkAdd([
      {
        id: crypto.randomUUID(), correlationId, orgId, event: 'subscription.selected', status: 'info',
        message: `${plan.name} plan selected.`, createdAt: now,
      },
      {
        id: crypto.randomUUID(), correlationId, orgId, event: 'subscription.activated', status: 'succeeded',
        message: `${plan.name} subscription activated.`, createdAt: now,
      },
      ...(invoice ? [
        {
          id: crypto.randomUUID(), correlationId, orgId, invoiceId: invoice.id, event: 'invoice.created' as const, status: 'info' as const,
          message: `${invoice.number} created for $${invoice.amount.toFixed(2)}.`, createdAt: now,
        },
        {
          id: crypto.randomUUID(), correlationId, orgId, invoiceId: invoice.id, event: 'payment.required' as const, status: 'pending' as const,
          message: `Payment is required for ${invoice.number}.`, createdAt: now,
        },
      ] : [{
        id: crypto.randomUUID(), correlationId, orgId, event: 'payment.not_required' as const, status: 'succeeded' as const,
        message: 'No payment is required for the Free plan.', createdAt: now,
      }]),
    ])
    if (invoice) await db.invoices.add(invoice)
    await db.auditLogs.add({
      id: crypto.randomUUID(), orgId, actorName, action: existing ? 'changed subscription plan' : 'activated subscription',
      target: plan.name, createdAt: now,
    })
  })
}
