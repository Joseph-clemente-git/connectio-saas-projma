import type { FeatureKey, PlanConfig, PlanLimits } from '@/lib/plans'

export type LimitKey = keyof PlanLimits

export function hasFeature(plan: PlanConfig, key: FeatureKey): boolean {
  return plan.features[key]
}

export function limitFor(plan: PlanConfig, key: LimitKey): number | null {
  return plan.limits[key]
}

export function canCreate(plan: PlanConfig, key: LimitKey, currentCount: number): boolean {
  const limit = limitFor(plan, key)
  if (limit === null) return true
  return currentCount < limit
}

export function remaining(plan: PlanConfig, key: LimitKey, currentCount: number): number | null {
  const limit = limitFor(plan, key)
  if (limit === null) return null
  return Math.max(0, limit - currentCount)
}

export function limitLabel(limit: number | null): string {
  return limit === null ? 'Unlimited' : String(limit)
}

export function usageLabel(current: number, limit: number | null): string {
  return limit === null ? `${current}` : `${current} / ${limit}`
}
