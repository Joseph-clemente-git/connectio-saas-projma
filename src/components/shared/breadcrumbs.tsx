import { Fragment, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: ReactNode
  to?: string
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <Fragment key={index}>
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}
              <li className={cn('min-w-0', current && 'text-foreground')}>
                {item.to && !current ? (
                  <Link className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={item.to}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={current ? 'page' : undefined}>{item.label}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
