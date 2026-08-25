import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'primary',
}: {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  accent?: 'primary' | 'accent' | 'success' | 'warning' | 'destructive'
}) {
  return (
    <Card className="flex items-start justify-between gap-4 p-5">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          accent === 'primary' && 'bg-primary/10 text-primary',
          accent === 'accent' && 'bg-accent/10 text-accent',
          accent === 'success' && 'bg-success/10 text-success',
          accent === 'warning' && 'bg-warning/10 text-warning',
          accent === 'destructive' && 'bg-destructive/10 text-destructive',
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </div>
    </Card>
  )
}
