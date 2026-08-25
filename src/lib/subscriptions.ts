import { db } from '@/db/schema'
import type { PlanTier } from '@/types/domain'

/** Updates the tenant's subscription reference and compatibility plan pointer together. */
export async function setOrganizationPlan(orgId: string, planId: PlanTier): Promise<void> {
  const plan = await db.planConfigs.get(planId)
  if (!plan) throw new Error('This plan is no longer available.')
  const existing = await db.subscriptions.where('orgId').equals(orgId).first()
  const now = new Date().toISOString()
  await db.transaction('rw', [db.organizations, db.subscriptions], async () => {
    if (existing) {
      await db.subscriptions.update(existing.id, { planId, status: 'active', updatedAt: now })
    } else {
      await db.subscriptions.add({ id: crypto.randomUUID(), orgId, planId, status: 'active', startedAt: now, updatedAt: now })
    }
    await db.organizations.update(orgId, { plan: planId })
  })
}
