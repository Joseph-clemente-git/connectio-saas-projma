import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, CircleCheck, Flag, Pencil, Plus, Repeat } from 'lucide-react'
import { differenceInCalendarDays, format } from 'date-fns'
import { db } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone, MilestoneStatus } from '@/types/domain'
import { calculateMilestoneDelivery, calculateMilestoneStatus } from '@/lib/schedule-health'

const STATUS_CONFIG: Record<MilestoneStatus, { variant: 'success' | 'warning' | 'destructive'; icon: typeof Flag; label: string }> = {
  completed: { variant: 'success', icon: CheckCircle2, label: 'Completed' },
  at_risk: { variant: 'warning', icon: AlertTriangle, label: 'At risk' },
  delayed: { variant: 'destructive', icon: AlertTriangle, label: 'Delayed' },
  on_track: { variant: 'success', icon: CircleCheck, label: 'On track' },
}

function completionTiming(completedAt: string, dueDate: string) {
  const difference = differenceInCalendarDays(new Date(completedAt), new Date(dueDate))
  if (difference === 0) return 'on time'
  return difference < 0 ? `${Math.abs(difference)} day${difference === -1 ? '' : 's'} early` : `${difference} day${difference === 1 ? '' : 's'} late`
}

export function MilestonesPanel({ projectId, canManage, finalStageId }: { projectId: string; canManage: boolean; finalStageId: string }) {
  const rows = useLiveQuery(async () => {
    const [milestones, sprints, tasks] = await Promise.all([
      db.milestones.where('projectId').equals(projectId).sortBy('dueDate'),
      db.sprints.where('projectId').equals(projectId).toArray(),
      db.tasks.where('projectId').equals(projectId).toArray(),
    ])
    return milestones.map((milestone) => ({
      milestone,
      delivery: calculateMilestoneDelivery(milestone.id, sprints, tasks, finalStageId),
    }))
  }, [finalStageId, projectId])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  const reset = () => {
    setEditingId(null)
    setName('')
    setDueDate('')
  }
  const openCreate = () => {
    reset()
    setOpen(true)
  }
  function openEdit(milestone: Pick<Milestone, 'id' | 'name' | 'dueDate'>) {
    setEditingId(milestone.id)
    setName(milestone.name)
    setDueDate(milestone.dueDate.slice(0, 10))
    setOpen(true)
  }
  async function save() {
    if (!name.trim() || !dueDate) return
    const values = { name: name.trim(), dueDate: new Date(dueDate).toISOString() }
    if (editingId) await db.milestones.update(editingId, values)
    else await db.milestones.add({ id: crypto.randomUUID(), projectId, ...values, status: 'on_track' })
    setOpen(false)
    reset()
  }

  return <div className="flex flex-1 flex-col gap-4 p-6">
    {canManage && <div className="flex justify-end"><Button size="sm" onClick={openCreate}><Plus aria-hidden="true" className="size-4" /> New milestone</Button></div>}
    {rows?.length ? <div className="flex flex-col gap-3">{rows.map(({ milestone, delivery }) => {
      const status = calculateMilestoneStatus(milestone.dueDate, delivery.isComplete)
      const config = STATUS_CONFIG[status]
      return <Card key={milestone.id}>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><config.icon aria-hidden="true" className="size-4" /></div>
            <div>
              <p className="font-medium text-foreground">{milestone.name}</p>
              <p className="text-xs text-muted-foreground">Due {format(new Date(milestone.dueDate), 'MMM d, yyyy')}</p>
              {milestone.completedAt && <p className="text-xs text-success">Completed {format(new Date(milestone.completedAt), 'MMM d, yyyy')} · {completionTiming(milestone.completedAt, milestone.dueDate)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2"><Badge variant={config.variant}>{config.label}</Badge>{canManage && <Button size="sm" variant="outline" onClick={() => openEdit(milestone)}><Pencil aria-hidden="true" className="size-4" /> Edit</Button>}</div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Repeat aria-hidden="true" className="size-3" /> Sprints {delivery.completedSprintCount}/{delivery.sprintCount}</span>
            <span className="tabular-nums">Tasks {delivery.completedTaskCount}/{delivery.taskCount} · Progress {delivery.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${milestone.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={delivery.progress}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${delivery.progress}%` }} /></div>
          {!delivery.hasLinkedWork && <p className="mt-2 text-xs text-warning">No delivery work linked yet. Link a sprint or assign a task directly before this milestone can be completed.</p>}
          {delivery.sprintCount > delivery.completedSprintCount && delivery.taskCount > 0 && delivery.completedTaskCount === delivery.taskCount && <p className="mt-2 text-xs text-warning">All tasks are done, but a linked sprint still needs to be completed.</p>}
        </CardContent>
      </Card>
    })}</div> : <EmptyState icon={Flag} title="No milestones yet" description="Set a due date for an outcome this project needs to achieve." actionLabel={canManage ? 'New milestone' : undefined} onAction={canManage ? openCreate : undefined} />}
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingId ? 'Edit milestone' : 'New milestone'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label htmlFor="ms-name">Name <span className="text-destructive">*</span></Label><Input id="ms-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Public launch" /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="ms-date">Due date <span className="text-destructive">*</span></Label><Input id="ms-date" required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-describedby="ms-date-help" /><p id="ms-date-help" className="text-xs text-muted-foreground">Use this to set the target date for a key project outcome, such as a launch, approval, or handover.</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!name.trim() || !dueDate}>{editingId ? 'Save changes' : 'Create milestone'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
