import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PLAN_ORDER, DEFAULT_PLANS, type FeatureKey } from '@/lib/plans'
import { limitLabel } from '@/lib/entitlements'
import { cn } from '@/lib/utils'

const HIGHLIGHT_FEATURES: Record<string, FeatureKey[]> = {
  free: [],
  pro: ['projectScheduling', 'calendar', 'gantt', 'projectTicketing', 'publicTicketPortal'],
  business: ['sla', 'ticketAutomation', 'customTicketForms', 'api'],
}

const FEATURE_SHORT_LABEL: Partial<Record<FeatureKey, string>> = {
  projectScheduling: 'Project scheduling',
  calendar: 'Calendar',
  gantt: 'Gantt & timeline',
  projectTicketing: 'Project ticketing',
  publicTicketPortal: 'Public ticket portal',
  sla: 'SLA policies',
  ticketAutomation: 'Ticket automation',
  customTicketForms: 'Custom ticket forms',
  api: 'API access',
}

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLAN_ORDER.map((tier) => {
        const plan = DEFAULT_PLANS[tier]
        const popular = tier === 'pro'
        return (
          <Card
            key={tier}
            className={cn(
              'flex flex-col gap-6 p-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
              popular && 'border-2 border-primary shadow-lg',
            )}
          >
            <CardHeader className="gap-2 pb-0">
              {popular && (
                <span className="w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-4xl font-extrabold tracking-tight text-foreground">${plan.monthlyPrice}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-6">
              <ul className="flex flex-col gap-2.5 text-sm">
                <FeatureRow label={`${limitLabel(plan.limits.teams)} teams`} />
                <FeatureRow label={`${limitLabel(plan.limits.members)} members`} />
                <FeatureRow label={`${limitLabel(plan.limits.workspaces)} workspaces`} />
                <FeatureRow label={`${limitLabel(plan.limits.projects)} projects`} />
                <FeatureRow label={`${plan.limits.storageGb} GB storage`} />
                {HIGHLIGHT_FEATURES[tier].map((key) => (
                  <FeatureRow key={key} label={FEATURE_SHORT_LABEL[key] ?? key} />
                ))}
              </ul>
              <Button variant={popular ? 'accent' : 'outline'} className="mt-auto w-full" asChild>
                <Link to={`/register?plan=${plan.id}`}>Get started with {plan.name}</Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function FeatureRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-foreground/90">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-3" />
      </span>
      {label}
    </li>
  )
}
