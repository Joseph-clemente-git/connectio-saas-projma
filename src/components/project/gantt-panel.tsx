import { useLiveQuery } from 'dexie-react-hooks'
import { differenceInCalendarDays, addDays, format, startOfWeek } from 'date-fns'
import { Flag, GanttChartSquare } from 'lucide-react'
import { db } from '@/db/schema'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-primary',
  planned: 'bg-muted-foreground/40',
  completed: 'bg-success',
}

export function GanttPanel({ projectId }: { projectId: string }) {
  const sprints = useLiveQuery(() => db.sprints.where('projectId').equals(projectId).sortBy('startDate'), [projectId])
  const milestones = useLiveQuery(() => db.milestones.where('projectId').equals(projectId).sortBy('dueDate'), [projectId])

  if (!sprints || !milestones) return null
  if (sprints.length === 0 && milestones.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={GanttChartSquare}
          title="Nothing to plot yet"
          description="Add sprints or milestones with dates and they'll appear here on a timeline."
        />
      </div>
    )
  }

  const allDates = [
    ...sprints.flatMap((s) => [new Date(s.startDate), new Date(s.endDate)]),
    ...milestones.map((m) => new Date(m.dueDate)),
  ]
  const rangeStart = startOfWeek(new Date(Math.min(...allDates.map((d) => d.getTime()))))
  const rangeEndRaw = new Date(Math.max(...allDates.map((d) => d.getTime())))
  const totalDays = Math.max(28, differenceInCalendarDays(rangeEndRaw, rangeStart) + 7)
  const weekCount = Math.ceil(totalDays / 7)

  function leftPct(date: Date) {
    return (differenceInCalendarDays(date, rangeStart) / totalDays) * 100
  }
  function widthPct(start: Date, end: Date) {
    return Math.max(1.5, (differenceInCalendarDays(end, start) / totalDays) * 100)
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      <div className="min-w-[720px]">
        {/* Week header */}
        <div className="mb-2 flex border-b border-border pb-2">
          <div className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</div>
          <div className="relative flex-1">
            <div className="flex">
              {Array.from({ length: weekCount }).map((_, i) => (
                <div key={i} className="flex-1 border-l border-border/60 pl-1.5 text-[11px] text-muted-foreground">
                  {format(addDays(rangeStart, i * 7), 'MMM d')}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {sprints.map((s) => (
            <div key={s.id} className="flex items-center">
              <div className="w-40 shrink-0 truncate pr-3 text-sm font-medium text-foreground">{s.name}</div>
              <div className="relative h-7 flex-1 rounded bg-muted/60">
                <div
                  className={cn('absolute top-1 h-5 rounded-full', STATUS_COLOR[s.status])}
                  style={{ left: `${leftPct(new Date(s.startDate))}%`, width: `${widthPct(new Date(s.startDate), new Date(s.endDate))}%` }}
                  title={`${s.name}: ${format(new Date(s.startDate), 'MMM d')} – ${format(new Date(s.endDate), 'MMM d')}`}
                />
              </div>
            </div>
          ))}

          {milestones.length > 0 && (
            <div className="flex items-center pt-2">
              <div className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Milestones</div>
              <div className="relative h-7 flex-1">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-0.5 flex flex-col items-center"
                    style={{ left: `${leftPct(new Date(m.dueDate))}%` }}
                    title={`${m.name}: ${format(new Date(m.dueDate), 'MMM d, yyyy')}`}
                  >
                    <Flag className="size-4 -translate-x-1/2 fill-accent text-accent" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
