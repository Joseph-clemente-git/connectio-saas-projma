import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpgradeDialog } from '@/store/upgrade'
import { nextTier as getNextTier, type PlanConfig } from '@/lib/plans'
import type { LimitKey } from '@/lib/entitlements'
import { canCreate, limitLabel } from '@/lib/entitlements'

/** "New X" button that disables itself with an upgrade nudge once the plan limit is hit. */
export function LimitButton({
  plan,
  limitKey,
  current,
  label,
  onClick,
}: {
  plan: PlanConfig
  limitKey: LimitKey
  current: number
  label: string
  onClick: () => void
}) {
  const openUpgrade = useUpgradeDialog((s) => s.openUpgrade)
  const allowed = canCreate(plan, limitKey, current)
  const limit = plan.limits[limitKey]

  if (allowed) {
    return (
      <Button onClick={onClick}>
        <Plus className="size-4" /> {label}
      </Button>
    )
  }

  const upgradeTarget = getNextTier(plan.id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          onClick={() => upgradeTarget && openUpgrade(`More than ${limitLabel(limit)} ${limitKey}`, upgradeTarget)}
        >
          <Plus className="size-4" /> {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {plan.name} plan limit reached ({current}/{limit}) — upgrade to add more
      </TooltipContent>
    </Tooltip>
  )
}
