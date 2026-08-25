import { useState } from 'react'
import { useOutletContext, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock3, ExternalLink, Globe, Mail, Paperclip, Send, Ticket as TicketIcon, Trash2, X, RotateCcw,
} from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useOrgMembersWithUsers, useOrgMemberRole } from '@/hooks/use-session-data'
import { hasFeature } from '@/lib/entitlements'
import { canReviewTickets } from '@/lib/permissions'
import { TICKET_PRIORITY_LABEL, TICKET_PROCESS_LABEL, TICKET_PROCESS_VARIANT, ticketProcessStatus } from '@/lib/ticket-ui'
import type { TicketPriority } from '@/types/domain'
import { displayTaskCode, nextTaskCode } from '@/lib/task-code'
import { workflowStages } from '@/lib/project-workflow'

export function TicketDetailPage() {
  const { org, user: currentUser, plan } = useOutletContext<TenantOutletContext>()
  const { ticketId } = useParams()
  const ticket = useLiveQuery(() => (ticketId ? db.tickets.get(ticketId) : undefined), [ticketId])
  const category = useLiveQuery(() => (ticket?.categoryId ? db.ticketCategories.get(ticket.categoryId) : undefined), [ticket?.categoryId])
  const categories = useLiveQuery(() => db.ticketCategories.where('orgId').equals(org.id).toArray(), [org.id])
  const comments = useLiveQuery(() => (ticketId ? db.ticketComments.where('ticketId').equals(ticketId).sortBy('createdAt') : []), [ticketId])
  const attachments = useLiveQuery(() => (ticketId ? db.ticketAttachments.where('ticketId').equals(ticketId).toArray() : []), [ticketId])
  const activities = useLiveQuery(() => (ticketId ? db.ticketActivities.where('ticketId').equals(ticketId).sortBy('createdAt') : []), [ticketId])
  const project = useLiveQuery(() => (ticket ? db.projects.get(ticket.projectId) : undefined), [ticket?.projectId])
  const convertedTask = useLiveQuery(() => (ticket?.convertedTaskId ? db.tasks.get(ticket.convertedTaskId) : undefined), [ticket?.convertedTaskId])
  const escalationOwner = useLiveQuery(() => (ticket?.escalatedToUserId ? db.users.get(ticket.escalatedToUserId) : undefined), [ticket?.escalatedToUserId])
  const members = useOrgMembersWithUsers(org.id)
  const myMembership = useOrgMemberRole(org.id, currentUser.id)
  const canReview = canReviewTickets(myMembership)
  const escalationApprovers = (members ?? []).filter(({ member, user }) => user.id === org.ownerId || (member.role === 'admin' && user.id !== currentUser.id))
  const canEscalate = canReview && ticket?.approval === 'pending' && !ticket?.escalatedAt
  const canDecideEscalation = ticket?.escalatedToUserId === currentUser.id && Boolean(ticket?.escalatedAt) && !ticket?.escalationApprovedAt
  const canReject = ticket?.escalatedAt ? canDecideEscalation : canReview
  const canApprove = ticket?.escalatedAt ? canDecideEscalation : canReview

  const [reply, setReply] = useState('')
  const [approveOpen, setApproveOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')
  const [escalationApproverId, setEscalationApproverId] = useState('')

  if (ticket === undefined) return <LoadingScreen />
  if (!ticket) {
    return (
      <div className="p-6">
        <EmptyState icon={TicketIcon} title="Ticket not found" description="It may have been deleted." />
      </div>
    )
  }

  function patch(fields: Partial<typeof ticket>) {
    if (!ticketId) return
    db.tickets.update(ticketId, { ...fields, updatedAt: new Date().toISOString() })
  }

  async function sendReply() {
    if (!reply.trim() || !ticketId) return
    await db.ticketComments.add({
      id: crypto.randomUUID(),
      ticketId,
      authorName: 'You',
      body: reply.trim(),
      internal: false,
      createdAt: new Date().toISOString(),
    })
    setReply('')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ticketId) return
    await db.ticketAttachments.add({
      id: crypto.randomUUID(),
      ticketId,
      fileName: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    })
    e.target.value = ''
  }

  async function approve() {
    if (!ticketId || !ticket || !project || !canApprove || ticket.convertedTaskId || approving) return
    setApproving(true)
    const taskId = crypto.randomUUID()
    const now = new Date().toISOString()
    const intakeStage = workflowStages(project)[0]
    try {
      await db.transaction('rw', [db.tasks, db.taskAttachments, db.tickets, db.ticketAttachments, db.ticketActivities], async () => {
        const [projectTasks, ticketAttachments] = await Promise.all([
          db.tasks.where('projectId').equals(ticket.projectId).toArray(),
          db.ticketAttachments.where('ticketId').equals(ticket.id).toArray(),
        ])
        await db.tasks.add({
          id: taskId,
          code: nextTaskCode(project, projectTasks),
          sourceTicketId: ticket.id,
          projectId: ticket.projectId,
          title: ticket.subject,
          description: ticket.description,
          status: intakeStage?.id ?? 'backlog',
          priority: ticket.priority,
          createdById: currentUser.id,
          order: projectTasks.filter((task) => task.status === (intakeStage?.id ?? 'backlog')).length,
          createdAt: now,
        })
        if (ticketAttachments.length) {
          await db.taskAttachments.bulkAdd(ticketAttachments.map((attachment) => ({
            id: crypto.randomUUID(),
            taskId,
            fileName: attachment.fileName,
            size: attachment.size,
            mimeType: attachment.mimeType,
            createdAt: now,
          })))
        }
        await db.tickets.update(ticketId, { approval: 'approved', convertedTaskId: taskId, ...(ticket.escalatedAt ? { escalationApprovedAt: now } : {}), status: 'resolved', updatedAt: now })
        await db.ticketActivities.add({ id: crypto.randomUUID(), ticketId, type: ticket.escalatedAt ? 'escalation_approved' : 'approved', actorName: currentUser.name, description: `Approved and copied to the ${intakeStage?.name ?? 'board intake'} as an unassigned task.`, createdAt: now })
      })
      setApproveOpen(false)
    } finally {
      setApproving(false)
    }
  }

  function reject() {
    if (!rejectReason.trim() || !canReject) return
    patch({ approval: 'rejected', approvalNote: rejectReason.trim(), status: 'closed' })
    setRejectOpen(false)
    setRejectReason('')
  }

  function reopen() {
    patch({ approval: 'pending', approvalNote: undefined, status: 'open', escalatedAt: undefined, escalationReason: undefined, escalatedByUserId: undefined, escalatedToUserId: undefined, escalationApprovedAt: undefined })
  }

  async function escalate() {
    if (!ticketId || !ticket || !escalationReason.trim() || !escalationApproverId || !canEscalate) return
    const now = new Date().toISOString()
    const approver = members?.find(({ user }) => user.id === escalationApproverId)?.user
    await db.transaction('rw', [db.tickets, db.ticketActivities], async () => {
      await db.tickets.update(ticketId, { status: 'waiting', escalatedAt: now, escalationReason: escalationReason.trim(), escalatedByUserId: currentUser.id, escalatedToUserId: escalationApproverId, updatedAt: now })
      await db.ticketActivities.add({ id: crypto.randomUUID(), ticketId, type: 'escalated', actorName: currentUser.name, description: `Escalated for approval to ${approver?.name ?? 'the organization decision-maker'}. Reason: ${escalationReason.trim()}`, createdAt: now })
    })
    setEscalateOpen(false)
    setEscalationReason('')
    setEscalationApproverId('')
  }

  const processStatus = ticketProcessStatus(ticket)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-1.5 text-base font-medium text-muted-foreground">
            <Link to="../tickets" className="flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Tickets
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="max-w-md truncate text-xl font-bold text-foreground">{ticket.subject}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {project && (
              <Badge variant="outline" className="gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </Badge>
            )}
            {ticket.source === 'portal' && (
              <Badge variant="outline" className="gap-1">
                <Globe className="size-3" /> Client portal
              </Badge>
            )}
            <Badge variant={TICKET_PROCESS_VARIANT[processStatus]}>{TICKET_PROCESS_LABEL[processStatus]}</Badge>
          </div>
        }
      />

      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {ticket.escalatedAt && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2"><AlertTriangle className="size-5 text-warning" aria-hidden="true" /><h2 className="font-semibold text-foreground">{ticket.escalationApprovedAt ? 'Escalation approved' : 'Internal escalation pending'}</h2></div>
                    <p className="mt-1 text-xs text-muted-foreground">Escalated {formatDistanceToNow(new Date(ticket.escalatedAt), { addSuffix: true })}{escalationOwner ? ` · ${ticket.escalationApprovedAt ? `Approved by ${escalationOwner.name}` : `Awaiting ${escalationOwner.name}`}` : ''}</p>
                  </div>
                  <Badge variant="warning">{TICKET_PRIORITY_LABEL[ticket.priority]} priority</Badge>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs font-medium text-muted-foreground">Client</p><p className="mt-1 text-foreground">{ticket.submitterName} · {ticket.submitterEmail}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">Project</p><p className="mt-1 text-foreground">{project?.name ?? 'Project unavailable'}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Request</p><p className="mt-1 font-medium text-foreground">{ticket.subject}</p><p className="mt-1 text-muted-foreground">{ticket.description || 'No description provided.'}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Reason for escalation</p><p className="mt-1 whitespace-pre-wrap text-foreground">{ticket.escalationReason}</p></div>
                </div>
                <div className="flex flex-wrap gap-4 border-t border-warning/20 pt-3 text-xs text-muted-foreground"><span>{comments?.length ?? 0} conversation message{comments?.length === 1 ? '' : 's'}</span><span>{attachments?.length ?? 0} attachment{attachments?.length === 1 ? '' : 's'}</span></div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="flex flex-col gap-3 py-5">
              <p className="text-sm text-foreground">{ticket.description || 'No description provided.'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="size-3.5" /> Client: {ticket.submitterName} ({ticket.submitterEmail}) ·{' '}
                {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Conversation</h3>
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <InitialsAvatar name={c.authorName} className="mt-0.5 size-7 shrink-0" />
                  <div className="flex-1 rounded-lg border border-border bg-card p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">{c.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No replies yet.</p>
            )}

            <div className="flex gap-2 pt-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
              />
              <Button onClick={sendReply} disabled={!reply.trim()} aria-label="Send reply">
                <Send className="size-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-5">
              <h3 className="text-sm font-semibold text-foreground">Activity history</h3>
              <div className="mt-4 space-y-4 border-l border-border pl-4">
                <div className="relative"><span className="absolute -left-[21px] top-0.5 flex size-3 items-center justify-center rounded-full bg-primary ring-4 ring-card" /><p className="text-sm font-medium text-foreground">Ticket created</p><p className="mt-0.5 text-xs text-muted-foreground">{ticket.submitterName} submitted this request · {format(new Date(ticket.createdAt), 'MMM d, yyyy, h:mm a')}</p></div>
                {activities?.map((activity) => <div key={activity.id} className="relative"><span className="absolute -left-[23px] top-0.5 flex size-4 items-center justify-center rounded-full bg-warning/15 ring-4 ring-card"><Clock3 className="size-2.5 text-warning" aria-hidden="true" /></span><p className="text-sm font-medium text-foreground">{activity.type === 'escalation_approved' ? 'Escalation approved and task created' : activity.type === 'approved' ? 'Ticket approved and task created' : 'Escalated for internal approval'}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{activity.actorName} · {format(new Date(activity.createdAt), 'MMM d, yyyy, h:mm a')}</p><p className="mt-1 text-sm text-foreground">{activity.description}</p></div>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Priority</span>
                <Select value={ticket.priority} onValueChange={(v) => patch({ priority: v as TicketPriority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TICKET_PRIORITY_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasFeature(plan, 'ticketCategories') && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Category</span>
                  <Select value={ticket.categoryId ?? 'none'} onValueChange={(v) => patch({ categoryId: v === 'none' ? undefined : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Assignee</span>
                <Select value={ticket.assigneeId ?? 'unassigned'} onValueChange={(v) => patch({ assigneeId: v === 'unassigned' ? undefined : v })}>
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
              {category && (
                <Badge variant="outline" className="w-fit gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </Badge>
              )}
            </CardContent>
          </Card>

          {hasFeature(plan, 'ticketToTask') && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Process status</span>
                  <Badge variant={TICKET_PROCESS_VARIANT[processStatus]}>{TICKET_PROCESS_LABEL[processStatus]}</Badge>
                </div>

                {ticket.approval === 'pending' && !ticket.escalatedAt && (
                  canReview ? (
                    <><p className="text-xs text-muted-foreground">Approve this request directly, route it for an owner or representative decision, or reject it with a reason.</p><div className="flex gap-2"><Button size="sm" className="flex-1" onClick={() => setApproveOpen(true)}><CheckCircle2 className="size-4" /> Approve</Button><Button size="sm" variant="outline" className="flex-1" onClick={() => setEscalateOpen(true)}><AlertTriangle className="size-4" /> Escalate</Button><Button variant="outline" size="sm" className="flex-1" onClick={() => setRejectOpen(true)}><X className="size-4" /> Reject</Button></div></>
                  ) : <p className="text-xs text-muted-foreground">Waiting for a project-team reviewer to decide this request.</p>
                )}

                {ticket.approval === 'pending' && ticket.escalatedAt && !ticket.escalationApprovedAt && (
                  canDecideEscalation ? (
                    <><p className="text-xs text-muted-foreground">You are the designated decision-maker. Approval copies this request to the project board for assignment.</p><div className="flex gap-2"><Button size="sm" className="flex-1" onClick={() => setApproveOpen(true)}><CheckCircle2 className="size-4" /> Approve</Button><Button variant="outline" size="sm" className="flex-1" onClick={() => setRejectOpen(true)}><X className="size-4" /> Reject</Button></div></>
                  ) : <p className="text-xs text-muted-foreground">Waiting for {escalationOwner?.name ?? 'the designated owner or representative'} to approve or reject this escalation.</p>
                )}

                {ticket.approval === 'approved' && (
                  <div className="flex flex-col gap-2">
                    <Badge variant="success" className="w-fit gap-1">
                      <CheckCircle2 className="size-3" /> Converted to task
                    </Badge>
                    <p className="text-xs text-muted-foreground">{convertedTask && project ? `${displayTaskCode(convertedTask, project)} is unassigned in ${workflowStages(project)[0]?.name ?? 'board intake'}.` : 'The task is ready for assignment on the project board.'}</p>
                    <Button asChild variant="outline" size="sm" className="w-fit">
                      <Link to={`/app/${org.slug}/projects/${ticket.projectId}?view=board${ticket.convertedTaskId ? `&task=${ticket.convertedTaskId}` : ''}`}><ExternalLink className="size-3.5" aria-hidden="true" /> Open board task</Link>
                    </Button>
                  </div>
                )}

                {ticket.approval === 'rejected' && (
                  <div className="flex flex-col gap-2">
                    {ticket.approvalNote && <p className="text-xs text-muted-foreground">{ticket.approvalNote}</p>}
                    {canReview && (
                      <Button variant="outline" size="sm" className="w-fit" onClick={reopen}>
                        <RotateCcw className="size-3.5" /> Reopen for review
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {hasFeature(plan, 'ticketAttachments') && (
            <Card>
              <CardContent className="flex flex-col gap-2 py-5">
                <span className="text-xs font-medium text-muted-foreground">Attachments</span>
                {attachments && attachments.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {attachments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                        <span className="flex items-center gap-1.5 truncate text-foreground">
                          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                          {a.fileName}
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => db.ticketAttachments.delete(a.id)}
                          aria-label={`Remove ${a.fileName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No files attached.</p>
                )}
                <label className="mt-1 flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Paperclip className="size-3.5" /> Attach a file
                  <input type="file" className="hidden" onChange={handleUpload} />
                </label>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve ticket</DialogTitle>
            <DialogDescription>
              Copies the title, description, priority, and attachments to {project?.name ?? 'this project'} as an unassigned task. The project leader or coordinator can assign it from the board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={approving}>
              Cancel
            </Button>
            <Button onClick={approve} disabled={!canApprove || approving}>
              Approve &amp; create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject ticket</DialogTitle>
            <DialogDescription>This request won't become a task. You can reopen it for review later.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">Reason *</Label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Duplicate, out of scope, needs more info…"
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate for approval</DialogTitle>
            <DialogDescription>Route this ticket through the project team to an organization decision-maker. The client is not part of this step.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="escalation-approver">Owner or representative</Label>
            <Select value={escalationApproverId} onValueChange={setEscalationApproverId}>
              <SelectTrigger id="escalation-approver"><SelectValue placeholder="Select a decision-maker" /></SelectTrigger>
              <SelectContent>{escalationApprovers.map(({ member, user }) => <SelectItem key={user.id} value={user.id}>{user.name}{member.role === 'owner' ? ' · Owner' : ' · Representative'}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Representatives are admins other than the project-team reviewer who is submitting this escalation.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="internal-escalation-reason">Reason for escalation *</Label>
            <textarea id="internal-escalation-reason" value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} rows={4} placeholder="Explain the decision needed, scope, or risk." className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button><Button onClick={escalate} disabled={!escalationReason.trim() || !escalationApproverId}>Send for approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
