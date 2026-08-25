import { Link, useParams } from 'react-router-dom'
import { Building2, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUpgradeDialog } from '@/store/upgrade'
import { DEFAULT_PLANS } from '@/lib/plans'

export function UpgradeDialog() {
  const { open, close, featureLabel, requiredPlan } = useUpgradeDialog()
  const plan = DEFAULT_PLANS[requiredPlan]
  const Icon = requiredPlan === 'business' ? Building2 : Zap
  const { orgSlug } = useParams()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon className="size-6" />
          </div>
          <DialogTitle>{featureLabel} is a {plan.name} feature</DialogTitle>
          <DialogDescription>
            Upgrade this organization to {plan.name} (${plan.monthlyPrice}/mo) to unlock {featureLabel}
            {' '}and everything else on the {plan.name} plan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Not now
          </Button>
          <Button variant="accent" asChild onClick={close}>
            <Link to={`/app/${orgSlug}/settings/billing`}>Upgrade to {plan.name}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
