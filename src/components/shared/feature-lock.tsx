import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpgradeDialog } from '@/store/upgrade'
import { hasFeature } from '@/lib/entitlements'
import type { FeatureKey, PlanConfig } from '@/lib/plans'
import { nextTier } from '@/lib/plans'

/** Gates a whole section/page behind a feature flag — used in addition to nav hiding, since a direct URL can bypass the sidebar. */
export function FeatureGate({
  plan,
  feature,
  label,
  children,
}: {
  plan: PlanConfig
  feature: FeatureKey
  label: string
  children: ReactNode
}) {
  const openUpgrade = useUpgradeDialog((s) => s.openUpgrade)

  if (hasFeature(plan, feature)) return <>{children}</>

  const target = nextTier(plan.id) ?? 'pro'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Lock className="size-6" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{label} is a {target === 'business' ? 'Business' : 'Pro'} feature</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Upgrade {plan.name} to unlock {label} for this organization.
        </p>
      </div>
      <Button variant="accent" onClick={() => openUpgrade(label, target)}>
        See upgrade options
      </Button>
    </div>
  )
}
