import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PricingCards } from '@/components/marketing/pricing-cards'
import { FeatureComparisonTable } from '@/components/marketing/feature-comparison-table'

export function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-primary">Pricing</span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple plans, every feature laid out
        </h1>
        <p className="max-w-xl text-muted-foreground">
          No hidden tiers. Compare exactly what unlocks at each level, from your first free organization to
          unlimited Business scale.
        </p>
      </div>

      <PricingCards />

      <div className="mt-20">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-foreground">Compare every feature</h2>
        <FeatureComparisonTable />
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Still deciding?</h2>
        <p className="max-w-md text-muted-foreground">
          Create your account, verify your email, and choose the plan that fits your organization.
        </p>
        <Button size="lg" variant="accent" asChild>
          <Link to="/register">
            Create your account <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
