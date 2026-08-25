import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, ClipboardPlus, Eye, FileImage, FileText, Flag, MessageCircle, Paperclip, Plus, RotateCcw, Send, Trash2, UserRound, X } from 'lucide-react'
import { db } from '@/db/schema'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InitialsAvatar } from '@/components/ui/avatar'
import { useOrgMembersWithUsers } from '@/hooks/use-session-data'
import { eligibleReviewerIds, reviewStageForTask, workflowStages } from '@/lib/project-workflow'
import { LinkifiedText } from '@/components/shared/linkified-text'
import type { Project, Task, TaskPriority, TaskStatus } from '@/types/domain'
import { displayTaskCode } from '@/lib/task-code'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function TaskDetailDialog({
  taskId,
  orgId,
  project,
  currentUserId,
  canManage,
  open,
  onOpenChange,
}: {
  taskId: string | null
  orgId: string
  project: Project
  currentUserId: string
  canManage: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const task = useLiveQuery(() => (taskId ? db.tasks.get(taskId) : undefined), [taskId])
  const subtasks = useLiveQuery(() => (taskId ? db.subtasks.where('taskId').equals(taskId).toArray() : []), [taskId])
  const comments = useLiveQuery(() => (taskId ? db.taskComments.where('taskId').equals(taskId).sortBy('createdAt') : []), [taskId])
  const attachments = useLiveQuery(() => (taskId ? db.taskAttachments.where('taskId').equals(taskId).sortBy('createdAt') : []), [taskId])
  const members = useOrgMembersWithUsers(orgId)
  const teams = useLiveQuery(() => db.teams.where('orgId').equals(orgId).toArray(), [orgId])
  const sprints = useLiveQuery(() => db.sprints.where('projectId').equals(project.id).toArray(), [project.id])
  const milestones = useLiveQuery(() => db.milestones.where('projectId').equals(project.id).sortBy('dueDate'), [project.id])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [flowError, setFlowError] = useState<string | null>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
    }
  }, [task?.id])

  useEffect(() => {
    if (!taskId || !open || !comments?.length) return
    void db.taskCommentReadStates.put({ id: `${taskId}:${currentUserId}`, taskId, userId: currentUserId, readAt: new Date().toISOString() })
  }, [comments?.length, currentUserId, open, taskId])

  if (!task) return null
  const activeTask = task
  const stages = workflowStages(project)
  const reviewStageIndex = stages.findIndex((stage) => stage.requiresReview)
  const reworkStageId = stages[Math.max(reviewStageIndex > 0 ? reviewStageIndex - 1 : stages.length - 2, 0)]?.id ?? stages[0]?.id ?? activeTask.status

  function patch(fields: Partial<Task>) {
    if (!taskId) return
    const changedApprovalFields: string[] = []
    if ('title' in fields && fields.title !== activeTask.title) changedApprovalFields.push('title')
    if ('description' in fields && fields.description !== activeTask.description) changedApprovalFields.push('description')
    if ('assigneeId' in fields && fields.assigneeId !== activeTask.assigneeId) changedApprovalFields.push('executor')
    const invalidatesApproval = activeTask.reviewState === 'approved' && changedApprovalFields.length > 0

    if (!invalidatesApproval) {
      void db.tasks.update(taskId, fields)
      return
    }

    const now = new Date().toISOString()
    void db.transaction('rw', [db.tasks, db.auditLogs], async () => {
      await db.tasks.update(taskId, { ...fields, status: reworkStageId, reviewState: undefined, reviewedAt: undefined })
      await db.auditLogs.add({
        id: crypto.randomUUID(),
        orgId,
        actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown member',
        action: `reopened approved task after changing ${changedApprovalFields.join(', ')}`,
        target: activeTask.title,
        createdAt: now,
      })
    })
  }

  function invalidateApprovedReview() {
    if (activeTask.reviewState === 'approved') {
      const now = new Date().toISOString()
      void db.transaction('rw', [db.tasks, db.auditLogs], async () => {
        await db.tasks.update(activeTask.id, { status: reworkStageId, reviewState: undefined, reviewedAt: undefined })
        await db.auditLogs.add({
          id: crypto.randomUUID(),
          orgId,
          actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown member',
          action: 'reopened approved task after changing subtasks',
          target: activeTask.title,
          createdAt: now,
        })
      })
    }
  }

  function changeStatus(status: TaskStatus) {
    const source = stages.find((stage) => stage.id === activeTask.status)
    const destination = stages.find((stage) => stage.id === status)
    if (source?.requiresReview) {
      setFlowError('Only a reviewer assigned in the project flow can approve this task or request changes from the board.')
      return
    }
    if (!(project.leadId === currentUserId || activeTask.assigneeId === currentUserId)) {
      setFlowError('Only the assigned executor or project leader can move this task.')
      return
    }
    if (status !== stages[0]?.id && !activeTask.sprintId) {
      setFlowError('Add this task to a sprint before moving it into planned work.')
      return
    }
    if (destination?.requiresReview && !activeTask.assigneeId) {
      setFlowError('Choose an executor before submitting this task for review.')
      return
    }
    if (destination?.requiresReview && eligibleReviewerIds(project, destination, teams ?? [], activeTask.assigneeId).length === 0) {
      setFlowError('No reviewer is available. Update this review stage in the project flow.')
      return
    }
    if (status === stages.at(-1)?.id && activeTask.reviewState !== 'approved' && stages.some((stage) => stage.requiresReview)) {
      setFlowError('This task can only be completed through reviewer approval.')
      return
    }
    patch({
      status,
      reviewState: destination?.requiresReview ? 'pending' : status === stages.at(-1)?.id ? activeTask.reviewState : undefined,
      reviewedAt: status === stages.at(-1)?.id ? activeTask.reviewedAt : undefined,
    })
    setFlowError(null)
  }

  async function reviewTask(decision: 'approved' | 'changes_requested') {
    const sourceIndex = stages.findIndex((stage) => stage.id === activeTask.status)
    const source = stages[sourceIndex]
    const assignedReviewerIds = eligibleReviewerIds(project, source, teams ?? [], activeTask.assigneeId)
    if (!source?.requiresReview || !assignedReviewerIds.includes(currentUserId)) {
      setFlowError('Only a reviewer assigned in the project flow can review this task.')
      return
    }
    const destination = stages[decision === 'approved' ? Math.min(sourceIndex + 1, stages.length - 1) : Math.max(sourceIndex - 1, 0)]
    const continuesIntoReview = decision === 'approved' && Boolean(destination?.requiresReview)
    const now = new Date().toISOString()
    await db.tasks.update(activeTask.id, {
      reviewState: continuesIntoReview ? 'pending' : decision,
      reviewedAt: continuesIntoReview ? undefined : now,
      status: destination?.id ?? activeTask.status,
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      orgId,
      actorName: members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Unknown reviewer',
      action: decision === 'approved' ? 'approved task' : 'requested changes on task',
      target: activeTask.title,
      createdAt: now,
    })
    setFlowError(null)
  }

  async function addSubtask() {
    if (!newSubtask.trim() || !taskId) return
    await db.subtasks.add({
      id: crypto.randomUUID(),
      taskId,
      title: newSubtask.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    })
    invalidateApprovedReview()
    setNewSubtask('')
  }

  async function addComment() {
    if (!taskId || (!commentBody.trim() && !commentFiles.length)) return
    const now = new Date().toISOString()
    const authorName = members?.find((member) => member.user.id === currentUserId)?.user.name ?? 'Project member'
    await db.transaction('rw', [db.taskComments, db.taskAttachments, db.taskCommentReadStates], async () => {
      if (commentBody.trim()) await db.taskComments.add({ id: crypto.randomUUID(), taskId, authorId: currentUserId, authorName, body: commentBody.trim(), createdAt: now })
      if (commentFiles.length) await db.taskAttachments.bulkAdd(commentFiles.map((file) => ({ id: crypto.randomUUID(), taskId, fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', blob: file, createdAt: now })))
      await db.taskCommentReadStates.put({ id: `${taskId}:${currentUserId}`, taskId, userId: currentUserId, readAt: now })
    })
    setCommentBody('')
    setCommentFiles([])
  }

  async function deleteTask() {
    if (!taskId) return
    await db.transaction('rw', [db.tasks, db.subtasks, db.taskComments, db.taskAttachments, db.taskCommentReadStates], async () => {
      await db.subtasks.where('taskId').equals(taskId).delete()
      await db.taskComments.where('taskId').equals(taskId).delete()
      await db.taskAttachments.where('taskId').equals(taskId).delete()
      await db.taskCommentReadStates.where('taskId').equals(taskId).delete()
      await db.tasks.delete(taskId)
    })
    onOpenChange(false)
  }

  const doneCount = subtasks?.filter((s) => s.done).length ?? 0
  const statusOptions = workflowStages(project).map((stage) => ({ value: stage.id, label: stage.name }))
  const creator = members?.find((member) => member.user.id === task.createdById)?.user
  const assignee = members?.find((member) => member.user.id === task.assigneeId)?.user
  const reviewStage = reviewStageForTask(project, task.status)
  const reviewerIds = eligibleReviewerIds(project, reviewStage, teams ?? [], task.assigneeId)
  const reviewers = reviewerIds.map((reviewerId) => members?.find((member) => member.user.id === reviewerId)?.user).filter(Boolean)
  const reviewerNames = reviewers.map((reviewer) => reviewer?.name).join(', ')
  const canCoordinateTask = canManage || project.coordinatorId === currentUserId
  const canExecuteTask = canCoordinateTask || task.assigneeId === currentUserId
  const currentStage = stages.find((stage) => stage.id === task.status)
  const canReviewTask = Boolean(currentStage?.requiresReview && reviewerIds.includes(currentUserId))
  const canChangeStatus = !currentStage?.requiresReview && (project.leadId === currentUserId || task.assigneeId === currentUserId)
  const selectedSprint = sprints?.find((sprint) => sprint.id === task.sprintId)
  const inheritedMilestoneId = selectedSprint?.milestoneId
  const effectiveMilestoneId = inheritedMilestoneId ?? task.milestoneId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-tour="task-detail" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit task</DialogTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex whitespace-nowrap rounded-md bg-muted px-2 py-0.5 font-mono font-semibold tracking-wide">{displayTaskCode(task, project)}</span>
            <span className="truncate">{project.name}</span>
          </div>
          <Input
            disabled={!canCoordinateTask}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && patch({ title: title.trim() })}
            className="border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <DialogDescription className="sr-only">Task details</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ClipboardPlus className="size-3.5" /> Added by</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{creator?.name ?? 'Imported / unknown'}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><UserRound className="size-3.5" /> Doing the work</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{assignee?.name ?? 'Not assigned'}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Eye className="size-3.5" /> Checking the work</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground" title={reviewerNames || undefined}>{reviewerNames || 'Not configured in project flow'}</p>
            </div>
          </div>
          {flowError && <div role="alert" className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><AlertCircle className="size-4 shrink-0" />{flowError}</div>}
          <textarea
            disabled={!canCoordinateTask}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => patch({ description: description.trim() || undefined })}
            placeholder="Add a description…"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={task.status} onValueChange={(v) => changeStatus(v as TaskStatus)} disabled={!canChangeStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeStatus && (
                <p className="text-xs text-muted-foreground">
                  {currentStage?.requiresReview
                    ? canReviewTask ? 'Use the review actions below.' : 'Only an assigned reviewer can approve or request changes.'
                    : 'Only the assigned executor or project leader can change status.'}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={task.priority} onValueChange={(v) => patch({ priority: v as TaskPriority })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Executor</Label>
              <Select
                disabled={!canCoordinateTask}
                value={task.assigneeId ?? 'unassigned'}
                onValueChange={(v) => {
                  const assigneeId = v === 'unassigned' ? undefined : v
                  patch({ assigneeId, reviewState: undefined, reviewedAt: undefined })
                  setFlowError(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map(({ user }) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sprint <span className="text-destructive">*</span></Label>
              <Select disabled={!canCoordinateTask} value={task.sprintId ?? 'unplanned'} onValueChange={(v) => { const sprint = sprints?.find((item) => item.id === v); patch({ sprintId: v === 'unplanned' ? undefined : v, milestoneId: sprint?.milestoneId ? undefined : task.milestoneId }); setFlowError(null) }}>
                <SelectTrigger><SelectValue placeholder="Choose sprint" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unplanned">Unplanned backlog</SelectItem>
                  {sprints?.map((sprint) => <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}{sprint.status === 'active' ? ' · active' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only sprint work appears on the delivery board.</p>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Milestone</Label>
              <Select disabled={!canCoordinateTask || Boolean(inheritedMilestoneId)} value={effectiveMilestoneId ?? 'none'} onValueChange={(v) => patch({ milestoneId: v === 'none' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="No milestone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {milestones?.map((milestone) => <SelectItem key={milestone.id} value={milestone.id}>{milestone.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flag aria-hidden="true" className="size-3" />{inheritedMilestoneId ? `Inherited from ${selectedSprint?.name}. Change the sprint link to choose a different milestone.` : 'Directly link this task when its sprint does not already define the milestone.'}</p>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
              <div><p className="text-sm font-medium text-foreground">Blocker</p><p className="text-xs text-muted-foreground">Show this task as blocked everywhere it appears.</p></div>
              <Button type="button" size="sm" variant={task.isBlocked ? 'destructive' : 'outline'} disabled={!canCoordinateTask} onClick={() => patch(task.isBlocked ? { isBlocked: false, blockerReason: undefined } : { isBlocked: true })}>
                <AlertCircle aria-hidden="true" className="size-3.5" />{task.isBlocked ? 'Blocked' : 'Mark blocked'}
              </Button>
            </div>
            {task.isBlocked && <div className="col-span-2 flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"><Label htmlFor="task-blocker-reason">Blocker reason <span className="text-destructive">*</span></Label><textarea id="task-blocker-reason" disabled={!canCoordinateTask} defaultValue={task.blockerReason ?? ''} onBlur={(event) => patch({ blockerReason: event.target.value.trim() || undefined })} rows={2} placeholder="What is preventing this task from moving forward?" className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/20" /><p className="text-xs text-muted-foreground">This reason is shown to teammates directly on the task card.</p></div>}
          </div>

          {currentStage?.requiresReview && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{currentStage.name}: review required</p>
                  <p className="text-xs text-muted-foreground">
                    {canReviewTask
                      ? 'You are an assigned reviewer. Approve this work or request changes.'
                      : reviewerNames ? `Waiting for ${reviewerNames} to review this work.` : 'No eligible reviewer is configured.'}
                  </p>
                </div>
                {canReviewTask && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => reviewTask('changes_requested')}><RotateCcw aria-hidden="true" className="size-4" /> Request changes</Button>
                    <Button type="button" className="min-h-11" onClick={() => reviewTask('approved')}><Check aria-hidden="true" className="size-4" /> Approve</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>
              Subtasks {subtasks && subtasks.length > 0 && `(${doneCount}/${subtasks.length})`}
            </Label>
            <div className="flex flex-col gap-1">
              {subtasks?.map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted">
                  <Checkbox
                    disabled={!canExecuteTask}
                    checked={s.done}
                    onCheckedChange={(checked) => { void db.subtasks.update(s.id, { done: Boolean(checked) }); invalidateApprovedReview() }}
                  />
                  <span className={s.done ? 'flex-1 text-sm text-muted-foreground line-through' : 'flex-1 text-sm text-foreground'}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    disabled={!canExecuteTask}
                    className="cursor-pointer text-muted-foreground transition-opacity hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => { void db.subtasks.delete(s.id); invalidateApprovedReview() }}
                    aria-label="Delete subtask"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                disabled={!canExecuteTask}
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask"
                className="h-9"
              />
              <Button size="sm" variant="outline" onClick={addSubtask} disabled={!canExecuteTask} aria-label="Add subtask">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <section className="border-t border-border pt-5" aria-labelledby="task-comments-heading">
            <div className="flex items-center justify-between gap-3"><div><h3 id="task-comments-heading" className="flex items-center gap-2 font-semibold text-foreground"><MessageCircle aria-hidden="true" className="size-4 text-primary" /> Comments</h3><p className="mt-1 text-xs text-muted-foreground">Paste a link and it becomes clickable automatically.</p></div><span className="text-xs tabular-nums text-muted-foreground">{comments?.length ?? 0}</span></div>
            <div className="mt-4 space-y-3">
              {comments?.length ? comments.map((comment) => <article key={comment.id} className="rounded-lg border border-border bg-muted/25 p-3"><p className="text-xs font-medium text-foreground">{comment.authorName}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground"><LinkifiedText text={comment.body} /></p></article>) : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No discussion yet. Add context, a blocker, or a link for the team.</p>}
            </div>
            <div className="mt-4 space-y-2"><Label htmlFor="task-comment">Add a comment</Label><textarea id="task-comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} placeholder="Write an update or paste https://..." className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20" /></div>
            <input ref={attachmentInput} type="file" className="hidden" multiple onChange={(event) => setCommentFiles(Array.from(event.target.files ?? []))} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Button type="button" variant="outline" size="sm" onClick={() => attachmentInput.current?.click()}><Paperclip aria-hidden="true" className="size-3.5" /> Attach files or screenshots</Button><Button type="button" size="sm" onClick={() => void addComment()} disabled={!commentBody.trim() && !commentFiles.length}><Send aria-hidden="true" className="size-3.5" /> Comment</Button></div>
            {commentFiles.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{commentFiles.map((file) => <span key={`${file.name}-${file.lastModified}`} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{file.type.startsWith('image/') ? <FileImage aria-hidden="true" className="size-3" /> : <FileText aria-hidden="true" className="size-3" />}{file.name}<button type="button" onClick={() => setCommentFiles((files) => files.filter((item) => item !== file))} aria-label={`Remove ${file.name}`} className="ml-1 text-muted-foreground hover:text-destructive"><X aria-hidden="true" className="size-3" /></button></span>)}</div>}
          </section>

          {attachments && attachments.length > 0 && <section className="border-t border-border pt-5" aria-labelledby="task-attachments-heading"><h3 id="task-attachments-heading" className="flex items-center gap-2 font-semibold text-foreground"><Paperclip aria-hidden="true" className="size-4 text-primary" /> Files & screenshots <span className="text-xs font-normal tabular-nums text-muted-foreground">({attachments.length})</span></h3><div className="mt-3 flex flex-wrap gap-2">{attachments.map((attachment) => <span key={attachment.id} className="flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{attachment.mimeType.startsWith('image/') ? <FileImage aria-hidden="true" className="size-3 shrink-0" /> : <FileText aria-hidden="true" className="size-3 shrink-0" />}<span className="max-w-52 truncate">{attachment.fileName}</span></span>)}</div></section>}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {assignee && <><InitialsAvatar name={assignee.name} color={assignee.avatarColor} className="size-5" /> Executor: {assignee.name}</>}
            </div>
            {canCoordinateTask && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteTask}>
                <Trash2 className="size-3.5" /> Delete task
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
