import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{start}-{end}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <span className="min-w-20 text-center text-sm text-muted-foreground">
          Page <span className="font-medium text-foreground">{safePage}</span> of {pageCount}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
