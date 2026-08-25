import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, CheckCircle2, Eye, Plus, UserRound, CalendarRange, ArrowRight, Link2, MessageCircle, Paperclip, RotateCcw } from 'lucide-react'
import { db } from '@/db/schema'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskDetailDialog } from '@/components/project/task-detail-dialog'
import { useOrgMembersWithUsers } from '@/hooks/use-session-data'
import { cn } from '@/lib/utils'
import { DEFAULT_TERMINOLOGY, eligibleReviewerIds, reviewStageForTask, reviewerIdsForStage, workflowStages } from '@/lib/project-workflow'
import { extractLinks } from '@/components/shared/linkified-text'
import type { Project, TaskPriority, TaskStatus } from '@/types/domain'
import { format } from 'date-fns'

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-warning',
  urgent: 'bg-destructive',
}

export function KanbanBoard({
  project,
  orgId,
  currentUserId,
  canManage,
}: {
  project: Project
  orgId: string
  currentUserId: string
  canManage: boolean
}) {
  const tasks = useLiveQuery(() => db.tasks.where('projectId').equals(project.id).sortBy('order'), [project.id])
  const sprints = useLiveQuery(() => db.sprints.where('projectId').equals(project.id).toArray(), [project.id])
  const subtaskCounts = useLiveQuery(async () => {
    const all = tasks ?? []
    const counts: Record<string, { total: number; done: number }> = {}
    for (const t of all) {
      const subs = await db.subtasks.where('taskId').equals(t.id).toArray()
      counts[t.id] = { total: subs.length, done: subs.filter((s) => s.done).length }
    }
    return counts
  }, [tasks])
  const taskActivity = useLiveQuery(async () => {
    const taskIds = tasks?.map((task) => task.id) ?? []
    if (!taskIds.length) return new Map<string, { comments: number; unread: number; attachments: number; links: number }>()
    const [comments, attachments, readStates] = await Promise.all([
      db.taskComments.where('taskId').anyOf(taskIds).toArray(),
      db.taskAttachments.where('taskId').anyOf(taskIds).toArray(),
      db.taskCommentReadStates.where('userId').equals(currentUserId).toArray(),
    ])
    const readAtByTask = new Map(readStates.map((state) => [state.taskId, state.readAt]))
    const activity = new Map<string, { comments: number; unread: number; attachments: number; links: number }>()
    for (const taskId of taskIds) activity.set(taskId, { comments: 0, unread: 0, attachments: 0, links: 0 })
    for (const comment of comments) {
      const metrics = activity.get(comment.taskId)
      if (!metrics) continue
      metrics.comments += 1
      if (comment.authorId !== currentUserId && (!readAtByTask.get(comment.taskId) || comment.createdAt > readAtByTask.get(comment.taskId)!)) metrics.unread += 1
      metrics.links += extractLinks(comment.body).length
    }
    for (const attachment of attachments) {
      const metrics = activity.get(attachment.taskId)
      if (metrics) metrics.attachments += 1
    }
    return activity
  }, [currentUserId, tasks])
  const members = useOrgMembersWithUsers(orgId)
  const teams = useLiveQuery(() => db.teams.where('orgId').equals(orgId).toArray(), [orgId])
  const [searchParams] = useSearchParams()

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [boardNotice, setBoardNotice] = useState<string | null>(null)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(() => searchParams.get('tutorialSprint'))
  const columns = workflowStages(project).map((stage) => ({ status: stage.id, label: stage.name, stage }))
  const terminology = project.terminology ?? DEFAULT_TERMINOLOGY
  const canAddTasks = canManage || project.leadId === currentUserId || project.coordinatorId === currentUserId
  const isProjectLeader = project.leadId === currentUserId
  const reviewTask = tasks?.find((task) => task.id === reviewTaskId)
  const reviewTaskStage = reviewTask ? workflowStages(project).find((stage) => stage.id === reviewTask.status) : undefined

  const effectiveSprintId = selectedSprintId

  useEffect(() => {
    const openTutorialTask = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId: string }>).detail.taskId
      if (tasks?.some((task) => task.id === taskId)) openTask(taskId)
    }
    window.addEventListener('connectio:tutorial-open-task', openTutorialTask)
    return () => window.removeEventListener('connectio:tutorial-open-task', openTutorialTask)
  }, [tasks])

  function openTask(taskId: string) {
    setActiveTaskId(taskId)
    window.dispatchEvent(new CustomEvent('connectio:tutorial-task-opened', { detail: { taskId } }))
  }

  async function reviewTaskDecision(decision: 'approved' | 'changes_requested') {
    if (!reviewTask || !reviewTaskStage?.requiresReview) return
    const reviewerIds = eligibleReviewerIds(project, reviewTaskStage, teams ?? [], reviewTask.assigneeId)
    if (!reviewerIds.includes(currentUserId)) return
    const taskStages = workflowStages(project)
    const currentIndex = taskStages.findIndex((stage) => stage.id === reviewTask.status)
    const destination = taskStages[decision === 'approved' ? Math.min(currentIndex + 1, taskStages.length - 1) : Math.max(currentIndex - 1, 0)]
    const continuesIntoReview = decision === 'approved' && Boolean(destination?.requiresReview)
    const now = new Date().toISOString()
    await db.tasks.update(reviewTask.id, {
      reviewState: continuesIntoReview ? 'pending' : decision,
      reviewedAt: continuesIntoReview ? undefined : now,
      status: destination?.id ?? reviewTask.status,
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      orgId,
      actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown reviewer',
      action: decision === 'approved' ? 'approved task' : 'requested changes on task',
      target: reviewTask.title,
      createdAt: now,
    })
    setReviewTaskId(null)
    setBoardNotice(null)
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = tasks?.find((item) => item.id === taskId)
    if (!task) return
    if (task.status === status) return
    const stages = workflowStages(project)
    const sourceIndex = stages.findIndex((stage) => stage.id === task.status)
    const destinationIndex = stages.findIndex((stage) => stage.id === status)
    const source = stages[sourceIndex]
    const destination = stages[destinationIndex]
    if (source?.requiresReview) {
      const reviewerIds = eligibleReviewerIds(project, source, teams ?? [], task.assigneeId)
      if (!reviewerIds.includes(currentUserId)) {
        setBoardNotice('Only a reviewer assigned in the project flow can approve this task or request changes.')
        return
      }
      setReviewTaskId(task.id)
      setBoardNotice(null)
      return
    }
    if (!(isProjectLeader || task.assigneeId === currentUserId)) {
      setBoardNotice('Only the assigned executor or project leader can move this task.')
      return
    }
    if (status !== columns[0]?.status && !task.sprintId) {
      setBoardNotice(`Add this ${terminology.workItem.toLowerCase()} to a ${terminology.timebox.toLowerCase()} before moving it into planned work.`)
      return
    }
    if (destination?.requiresReview && !task.assigneeId) {
      setBoardNotice('Assign an executor before submitting work for review.')
      return
    }
    if (destination?.requiresReview && eligibleReviewerIds(project, destination, teams ?? [], task.assigneeId).length === 0) {
      setBoardNotice('No reviewer is available. Update this review stage in the project flow.')
      return
    }
    if (status === columns.at(-1)?.status && task.reviewState !== 'approved' && workflowStages(project).some((stage) => stage.requiresReview)) {
      setBoardNotice('Reviewer approval is required before completion.')
      return
    }
    await db.tasks.update(taskId, {
      status,
      reviewState: destination?.requiresReview ? 'pending' : status === columns.at(-1)?.status ? task.reviewState : undefined,
      reviewedAt: status === columns.at(-1)?.status ? task.reviewedAt : undefined,
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      orgId,
      actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown member',
      action: `moved task to ${destination?.name ?? status}`,
      target: task.title,
      createdAt: new Date().toISOString(),
    })
    setBoardNotice(null)
  }

  async function createTask(status: TaskStatus) {
    if (!newTitle.trim()) {
      setAddingIn(null)
      return
    }
    if (!effectiveSprintId) {
      setBoardNotice(`Choose a ${terminology.timebox.toLowerCase()} before adding work to the delivery board.`)
      setAddingIn(null)
      return
    }
    const count = tasks?.filter((t) => t.status === status).length ?? 0
    const taskId = crypto.randomUUID()
    await db.tasks.add({
      id: taskId,
      projectId: project.id,
      sprintId: effectiveSprintId,
      title: newTitle.trim(),
      status,
      priority: 'medium',
      createdById: currentUserId,
      order: count,
      createdAt: new Date().toISOString(),
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      orgId,
      actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown member',
      action: `added ${terminology.workItem.toLowerCase()}`,
      target: newTitle.trim(),
      createdAt: new Date().toISOString(),
    })
    setNewTitle('')
    setAddingIn(null)
    window.dispatchEvent(new CustomEvent('connectio:tutorial-task-created', { detail: { projectId: project.id, taskId } }))
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{terminology.timebox} delivery board</p>
          <p className="text-xs text-muted-foreground">Coordinator adds work → executor completes it → the project flow assigns review → reviewer approves it.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground">Manager:</strong> {members?.find((m) => m.user.id === project.leadId)?.user.name ?? 'Unassigned'}</span>
          <span><strong className="text-foreground">Coordinator:</strong> {members?.find((m) => m.user.id === project.coordinatorId)?.user.name ?? 'Unassigned'}</span>
          <span><strong className="text-foreground">Default reviewer:</strong> {members?.find((m) => m.user.id === project.reviewerId)?.user.name ?? 'Not configured'}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
        <div data-tour="board-sprint" className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarRange className="size-4 text-primary" /><span className="font-medium text-foreground">Viewing:</span>
          <select aria-label={`Choose ${terminology.timebox.toLowerCase()} to view`} className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" value={effectiveSprintId ?? ''} onChange={(e) => setSelectedSprintId(e.target.value || null)}>
            <option value="">All committed {terminology.timeboxPlural.toLowerCase()}</option>
            {sprints?.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (active)' : ''}</option>)}
          </select>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">Backlog <ArrowRight className="size-3" /> assign sprint <ArrowRight className="size-3" /> deliver <ArrowRight className="size-3" /> review <ArrowRight className="size-3" /> complete</p>
      </div>
      {boardNotice && <div role="alert" className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"><AlertCircle className="size-4" />{boardNotice}</div>}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
      {columns.map((col) => {
        const colTasks = tasks?.filter((t) => t.sprintId && (!effectiveSprintId || t.sprintId === effectiveSprintId) && t.status === col.status) ?? []
        return (
          <div
            key={col.status}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl bg-muted/60 transition-colors',
              dragOverStatus === col.status && 'bg-primary/10 ring-2 ring-primary/30',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStatus(col.status)
            }}
            onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              const taskId = e.dataTransfer.getData('text/task-id')
              if (taskId) moveTask(taskId, col.status)
              setDragOverStatus(null)
            }}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</span>{col.stage.requiresReview && <p className="mt-0.5 text-[11px] text-primary">Review: {reviewerIdsForStage(project, col.stage, teams ?? []).map((id) => members?.find((m) => m.user.id === id)?.user.name).filter(Boolean).join(', ') || 'not configured'}</p>}</div>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {colTasks.length}
              </span>
            </div>

            <div className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2">
              {colTasks.map((task) => {
                const assignee = members?.find((m) => m.user.id === task.assigneeId)?.user
                const currentStage = columns.find((column) => column.status === task.status)?.stage
                const taskReviewerIds = eligibleReviewerIds(project, reviewStageForTask(project, task.status), teams ?? [], task.assigneeId)
                const reviewers = taskReviewerIds.map((id) => members?.find((m) => m.user.id === id)?.user).filter(Boolean)
                const reviewer = reviewers[0]
                const reviewerNames = reviewers.map((item) => item?.name).join(', ')
                const subs = subtaskCounts?.[task.id]
                const activity = taskActivity?.get(task.id)
                const canMoveTask = currentStage?.requiresReview
                  ? taskReviewerIds.includes(currentUserId)
                  : isProjectLeader || task.assigneeId === currentUserId
                const moveRestriction = currentStage?.requiresReview
                  ? 'Only a reviewer assigned in the project flow can review this task.'
                  : 'Only the assigned executor or project leader can move this task.'
                return (
                  <button
                    type="button"
                    key={task.id}
                    data-tour-task={task.id}
                    draggable={canMoveTask}
                    title={canMoveTask ? undefined : moveRestriction}
                    onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                    onClick={() => openTask(task.id)}
                    className={cn(
                      'group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md',
                      canMoveTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{task.id}</p><p className="mt-0.5 text-sm font-medium text-foreground">{task.title}</p></div>{task.isBlocked && <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"><AlertCircle aria-hidden="true" className="size-3" />Blocked</span>}</div>
                    {task.isBlocked && <p className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs leading-5 text-foreground"><span className="font-medium text-destructive">Reason: </span>{task.blockerReason || 'Reason not added yet.'}</p>}
                    {(activity?.unread || activity?.attachments || activity?.links) ? <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-label={`Task activity: ${activity.unread} unread comments, ${activity.attachments} files, ${activity.links} links`}>
                      {activity.unread > 0 && <span className="flex items-center gap-1 font-medium text-primary"><MessageCircle aria-hidden="true" className="size-3" />{activity.unread} unread</span>}
                      {activity.attachments > 0 && <span className="flex items-center gap-1"><Paperclip aria-hidden="true" className="size-3" />{activity.attachments}</span>}
                      {activity.links > 0 && <span className="flex items-center gap-1"><Link2 aria-hidden="true" className="size-3" />{activity.links}</span>}
                    </div> : null}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', PRIORITY_DOT[task.priority])} />
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground">{format(new Date(task.dueDate), 'MMM d')}</span>
                        )}
                        {subs && subs.total > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {subs.done}/{subs.total}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {assignee ? <span title={`Executor: ${assignee.name}`}><InitialsAvatar name={assignee.name} color={assignee.avatarColor} className="size-6" /></span> : <span title="Executor unassigned" className="flex size-6 items-center justify-center rounded-full border border-dashed border-warning text-warning"><UserRound className="size-3" /></span>}
                        {reviewer && <span title={`Project-flow reviewer${reviewers.length > 1 ? 's' : ''}: ${reviewerNames}`} className="relative"><InitialsAvatar name={reviewer.name} color={reviewer.avatarColor} className="size-6" /><Eye className="absolute -bottom-1 -right-1 size-3 rounded-full bg-card p-0.5 text-primary" />{reviewers.length > 1 && <span className="absolute -top-1 -left-1 rounded-full bg-primary px-1 text-[9px] font-semibold leading-3 text-primary-foreground">+{reviewers.length - 1}</span>}</span>}
                        {task.reviewState === 'approved' && <CheckCircle2 className="size-4 text-success" aria-label="Review approved" />}
                      </div>
                    </div>
                  </button>
                )
              })}

              {addingIn === col.status ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2">
                  <Input
                    data-tour="task-title"
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createTask(col.status)
                      if (e.key === 'Escape') setAddingIn(null)
                    }}
                    onBlur={() => createTask(col.status)}
                    placeholder="Task title"
                    className="h-8 text-sm"
                  />
                </div>
              ) : canAddTasks && effectiveSprintId && col.status === columns[0]?.status ? (
                <Button
                  data-tour="add-task"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-muted-foreground"
                  onClick={() => {
                    setAddingIn(col.status)
                    window.dispatchEvent(new CustomEvent('connectio:tutorial-composer-opened', { detail: { projectId: project.id } }))
                  }}
                >
                  <Plus className="size-3.5" /> Add {terminology.workItem.toLowerCase()}
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}

      {tasks?.some((task) => !task.sprintId) && <div className="mx-6 mb-5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{tasks.filter((task) => !task.sprintId).length} unplanned {terminology.workItem.toLowerCase()}(s)</span> remain outside the delivery board. Assign them to a {terminology.timebox.toLowerCase()} before they enter active delivery.</div>}
      <TaskDetailDialog
        taskId={activeTaskId}
        orgId={orgId}
        project={project}
        currentUserId={currentUserId}
        canManage={canManage}
        open={activeTaskId !== null}
        onOpenChange={(v) => !v && setActiveTaskId(null)}
      />
      <Dialog open={reviewTaskId !== null} onOpenChange={(nextOpen) => !nextOpen && setReviewTaskId(null)}>
        <DialogContent role="alertdialog" className="w-[calc(100vw-2rem)] max-w-lg gap-5 p-5 sm:p-7">
          <DialogHeader className="pr-8">
            <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Eye aria-hidden="true" className="size-5" />
            </div>
            <DialogTitle>Confirm your review decision</DialogTitle>
            <DialogDescription>
              You selected <span className="font-medium text-foreground">{reviewTask?.title}</span> in a review stage. Choose what should happen next.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current review stage</p>
            <p className="mt-1 font-medium text-foreground">{reviewTaskStage?.name}</p>
            <p className="mt-2 leading-5 text-muted-foreground">Approve to advance this task, or request changes to return it to the previous stage.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full justify-start px-3 sm:w-fit"
            onClick={() => {
              if (!reviewTask) return
              setReviewTaskId(null)
              setActiveTaskId(reviewTask.id)
            }}
          >
            View task details
          </Button>
          <DialogFooter className="border-t border-border pt-4 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="ghost" className="min-h-11 w-full sm:mr-auto sm:w-auto" onClick={() => setReviewTaskId(null)}>Cancel</Button>
            <Button type="button" variant="outline" className="min-h-11 w-full whitespace-nowrap sm:w-auto" onClick={() => reviewTaskDecision('changes_requested')}>
              <RotateCcw aria-hidden="true" className="size-4" /> Request changes
            </Button>
            <Button type="button" className="min-h-11 w-full whitespace-nowrap sm:w-auto" onClick={() => reviewTaskDecision('approved')}>
              <Check aria-hidden="true" className="size-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
