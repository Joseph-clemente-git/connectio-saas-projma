import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'

export function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string
  description: string
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
