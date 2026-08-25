import { Zap, Building2, Sparkles, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PlanTier } from '@/types/domain'
import { cn } from '@/lib/utils'

const CONFIG: Record<PlanTier, { label: string; icon: typeof Zap; className: string }> = {
  free: { label: 'Free', icon: Sparkles, className: 'bg-muted text-muted-foreground' },
  pro: { label: 'Pro', icon: Zap, className: 'bg-primary/10 text-primary' },
  business: { label: 'Business', icon: Building2, className: 'bg-accent/10 text-accent' },
}

export function PlanBadge({ plan, className }: { plan?: PlanTier; className?: string }) {
  const { label, icon: Icon, className: variantClass } = plan ? CONFIG[plan] : { label: 'Setup pending', icon: Clock3, className: 'bg-warning/10 text-warning' }
  return (
    <Badge variant="outline" className={cn('border-transparent font-semibold', variantClass, className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}
