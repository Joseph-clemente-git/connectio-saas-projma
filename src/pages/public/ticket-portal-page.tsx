import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, ClipboardList, FilePlus2, Globe, Layers3, MessageSquarePlus, Paperclip, Send, Waypoints } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '@/db/schema'
import { DEFAULT_PLANS } from '@/lib/plans'
import { hasFeature } from '@/lib/entitlements'
import { workflowStages } from '@/lib/project-workflow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientImportPanel } from '@/components/client-portal/client-import-panel'
import { TICKET_APPROVAL_LABEL, TICKET_APPROVAL_VARIANT, TICKET_STATUS_LABEL, TICKET_STATUS_VARIANT } from '@/lib/ticket-ui'
import type { Ticket } from '@/types/domain'

export function TicketPortalPage() {
  const { orgSlug, projectId } = useParams()
  const org = useLiveQuery(() => (orgSlug ? db.organizations.where('slug').equals(orgSlug).first() : undefined), [orgSlug])
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const categories = useLiveQuery(() => (org ? db.ticketCategories.where('orgId').equals(org.id).toArray() : []), [org?.id])
  const tasks = useLiveQuery(() => (projectId ? db.tasks.where('projectId').equals(projectId).sortBy('order') : []), [projectId])
  const tickets = useLiveQuery(() => (projectId ? db.tickets.where('projectId').equals(projectId).reverse().sortBy('updatedAt') : []), [projectId])
  const clientConversation = useLiveQuery(async () => {
    if (!org || !projectId) return undefined
    return (await db.chatConversations.where('orgId').equals(org.id).toArray()).find((room) => room.scope === 'client' && room.projectId === projectId)
  }, [org?.id, projectId])
  const clientMessages = useLiveQuery(() => clientConversation ? db.chatMessages.where('conversationId').equals(clientConversation.id).sortBy('createdAt') : [], [clientConversation?.id]) ?? []
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('none')
  const [submitted, setSubmitted] = useState(false)
  const [resubmitted, setResubmitted] = useState(false)
  const [resubmissionOfTicketId, setResubmissionOfTicketId] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('board')
  const [requestAttachments, setRequestAttachments] = useState<File[]>([])
  const requestAttachmentInput = useRef<HTMLInputElement>(null)
  const [clientMessage, setClientMessage] = useState('')
  const [clientAttachments, setClientAttachments] = useState<File[]>([])
  const clientAttachmentInput = useRef<HTMLInputElement>(null)

  const progress = useMemo(() => {
    const all = tasks ?? []
    const done = all.filter((task) => project && task.status === workflowStages(project).at(-1)?.id).length
    return { total: all.length, done, percent: all.length ? Math.round(done / all.length * 100) : 0 }
  }, [tasks, project])

  async function submit() {
    if (!org || !project || !name.trim() || !email.trim() || !subject.trim()) return
    const now = new Date().toISOString()
    const ticketId = crypto.randomUUID()
    const isResubmission = Boolean(resubmissionOfTicketId)
    await db.transaction('rw', [db.tickets, db.ticketAttachments], async () => {
      await db.tickets.add({ id: ticketId, orgId: org.id, projectId: project.id, categoryId: categoryId === 'none' ? undefined : categoryId, subject: subject.trim(), description: description.trim(), status: 'open', priority: 'medium', submitterName: name.trim(), submitterEmail: email.trim(), source: 'portal', approval: 'pending', resubmissionOfTicketId, createdAt: now, updatedAt: now })
      if (requestAttachments.length) await db.ticketAttachments.bulkAdd(requestAttachments.map((file) => ({ id: crypto.randomUUID(), ticketId, fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' })))
    })
    setSubmitted(true); setResubmitted(isResubmission); setSubject(''); setDescription(''); setRequestAttachments([]); setResubmissionOfTicketId(undefined)
  }
  function resubmitTicket(ticket: Ticket) {
    setName(ticket.submitterName)
    setEmail(ticket.submitterEmail)
    setSubject(ticket.subject)
    setDescription(ticket.description)
    setCategoryId(ticket.categoryId ?? 'none')
    setResubmissionOfTicketId(ticket.id)
    setSubmitted(false)
    setActiveTab('new')
  }
  async function decideScope(ticketId: string, approved: boolean) {
    await db.tickets.update(ticketId, { status: approved ? 'open' : 'waiting', approvalNote: approved ? 'Client approved the proposed scope.' : 'Client requested changes to the proposed scope.', updatedAt: new Date().toISOString() })
  }
  async function sendClientMessage() {
    if (!org || !project || (!clientMessage.trim() && !clientAttachments.length)) return
    const clientName = name.trim() || 'Client'
    const clientEmail = email.trim() || 'client@example.com'
    const now = new Date().toISOString()
    let conversation = clientConversation
    if (!conversation) {
      conversation = { id: crypto.randomUUID(), orgId: org.id, name: `${clientName} · Client`, scope: 'client' as const, participantIds: [project.leadId ?? org.ownerId, `client:${clientEmail}`], projectId: project.id, clientName, clientEmail, createdAt: now }
      await db.chatConversations.add(conversation)
    }
    await db.chatMessages.add({ id: crypto.randomUUID(), conversationId: conversation.id, authorId: `client:${clientEmail}`, authorName: clientName, authorType: 'client', body: clientMessage.trim(), attachments: clientAttachments.map((file) => ({ id: crypto.randomUUID(), fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' })), createdAt: now })
    setClientMessage(''); setClientAttachments([])
  }
  if (org === undefined || project === undefined) return null
  const plan = org?.plan ? DEFAULT_PLANS[org.plan] : undefined
  const available = org && project && project.orgId === org.id && plan && hasFeature(plan, 'publicTicketPortal')
  if (!available) return <PortalShell><EmptyState icon={Globe} title="Portal not available" description="This link is invalid, or the project portal is not enabled." /></PortalShell>
  const stages = workflowStages(project)
  const visibleTickets = tickets ?? []
  return <PortalShell><main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
      <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><span className="size-2 rounded-full bg-success" /> Client project portal</div><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{project.name}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{project.description || `Follow progress and coordinate work with ${org.name}.`}</p></div>
      <div className="min-w-52 rounded-xl bg-muted/50 p-4"><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Project progress</span><strong className="text-foreground">{progress.percent}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress.percent}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{progress.done} of {progress.total} work items complete</p></div>
    </div>
    <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList className="mb-6 h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 sm:w-auto"><TabsTrigger value="board" className="gap-2"><Layers3 className="size-4" /> Board</TabsTrigger><TabsTrigger value="messages" className="gap-2"><MessageSquarePlus className="size-4" /> Messages <span className="rounded-full bg-muted px-1.5 text-[11px]">{clientMessages.length}</span></TabsTrigger><TabsTrigger value="requests" className="gap-2"><ClipboardList className="size-4" /> Requests <span className="rounded-full bg-muted px-1.5 text-[11px]">{visibleTickets.length}</span></TabsTrigger><TabsTrigger value="new" className="gap-2"><MessageSquarePlus className="size-4" /> New request</TabsTrigger><TabsTrigger value="import" className="gap-2"><FilePlus2 className="size-4" /> Bulk import</TabsTrigger></TabsList>
      <TabsContent value="board" className="mt-0"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold text-foreground">Project board</h2><p className="text-sm text-muted-foreground">A focused view of work shared with you. Internal planning tools stay private.</p></div><Badge variant="outline">Updated live</Badge></div><div className="grid gap-4 xl:grid-cols-5">{stages.map((stage) => { const items = (tasks ?? []).filter((task) => task.status === stage.id); return <section key={stage.id} className="min-h-56 rounded-xl border border-border bg-muted/35 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{stage.name}</h3><span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span></div><div className="space-y-2">{items.map((task) => <article key={task.id} className="rounded-lg border border-border bg-card p-3 shadow-xs"><div className="mb-2 flex items-start justify-between gap-2"><p className="text-sm font-semibold leading-5 text-foreground">{task.title}</p><span className={`mt-1 size-2 shrink-0 rounded-full ${task.priority === 'urgent' ? 'bg-destructive' : task.priority === 'high' ? 'bg-warning' : 'bg-primary'}`} /></div>{task.description && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>}{task.dueDate && <p className="mt-3 text-xs text-muted-foreground">Target: {format(new Date(task.dueDate), 'MMM d')}</p>}</article>)}{items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No shared work</p>}</div></section>})}</div></TabsContent>
      <TabsContent value="messages" className="mt-0"><Card><CardHeader><CardTitle>Message the project team</CardTitle><CardDescription>Private client communication — internal organization chat is never shared here.</CardDescription></CardHeader><CardContent><div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-muted/35 p-4">{clientMessages.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Start a conversation with your project lead.</p> : clientMessages.map((message) => <article key={message.id} className={`max-w-[88%] rounded-xl border p-3 text-sm ${message.authorType === 'client' ? 'ml-auto border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}><b className="text-xs">{message.authorName ?? (message.authorType === 'client' ? 'You' : 'Project team')}</b><p className="mt-1 whitespace-pre-wrap">{message.body}</p>{message.attachments?.map((attachment) => <p key={attachment.id} className="mt-2 text-xs">Attachment: {attachment.fileName}</p>)}</article>)}</div><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void sendClientMessage() }}><input ref={clientAttachmentInput} type="file" multiple className="hidden" onChange={(event) => setClientAttachments(Array.from(event.target.files ?? []))} /><Input value={clientMessage} onChange={(event) => setClientMessage(event.target.value)} placeholder="Write a message or paste a link" aria-label="Message the project team" /><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => clientAttachmentInput.current?.click()} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted"><Paperclip className="size-4" /> Attach files</button><Button type="submit" disabled={!clientMessage.trim() && !clientAttachments.length}><Send className="size-4" /> Send message</Button></div>{clientAttachments.map((file) => <p key={`${file.name}-${file.lastModified}`} className="text-xs text-muted-foreground">Ready to send: {file.name}</p>)}</form></CardContent></Card></TabsContent>
      <TabsContent value="requests" className="mt-0"><Card><CardHeader><CardTitle>Your requests</CardTitle><CardDescription>Track each request from review through approval and delivery.</CardDescription></CardHeader><CardContent className="space-y-3">{visibleTickets.length === 0 ? <EmptyState icon={ClipboardList} title="No requests yet" description="Submit a request or import a prepared list to get started." /> : visibleTickets.map((ticket) => <div key={ticket.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{ticket.subject}</p><Badge variant={TICKET_STATUS_VARIANT[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge><Badge variant={TICKET_APPROVAL_VARIANT[ticket.approval]}>{TICKET_APPROVAL_LABEL[ticket.approval]}</Badge>{ticket.resubmissionOfTicketId && <Badge variant="outline">Resubmitted</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">Submitted {format(new Date(ticket.createdAt), 'MMM d, yyyy')} · {ticket.convertedTaskId ? 'Converted to project work' : ticket.approval === 'pending' ? 'Awaiting team review' : 'Team decision recorded'}</p>{ticket.approvalNote && <p className="mt-2 text-xs text-muted-foreground">{ticket.approvalNote}</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{ticket.status === 'waiting' && ticket.approval === 'pending' && <><Button size="sm" onClick={() => decideScope(ticket.id, true)}>Approve scope</Button><Button size="sm" variant="outline" onClick={() => decideScope(ticket.id, false)}>Request changes</Button></>}{ticket.approval === 'rejected' && <Button size="sm" onClick={() => resubmitTicket(ticket)}>Resubmit</Button>}</div></div>)}</CardContent></Card></TabsContent>
      <TabsContent value="new" className="mt-0"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Card><CardHeader><CardTitle>{resubmissionOfTicketId ? 'Resubmit a request' : 'Submit a request'}</CardTitle><CardDescription>Tell us what you need. Your request is reviewed before any delivery work begins.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{submitted && <div role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="size-4" /> {resubmitted ? 'Request resubmitted. It is now in review.' : 'Request submitted. It is now in review.'}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="portal-name">Your name *</Label><Input id="portal-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div><div className="space-y-1.5"><Label htmlFor="portal-email">Email *</Label><Input id="portal-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div></div><div className="space-y-1.5"><Label htmlFor="portal-subject">Request title *</Label><Input id="portal-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="portal-desc">What would you like us to do?</Label><textarea id="portal-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20" /></div>{categories && categories.length > 0 && <div className="space-y-1.5"><Label>Request type</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">General request</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2"><Label>Attachments</Label><input ref={requestAttachmentInput} type="file" multiple className="hidden" onChange={(event) => setRequestAttachments(Array.from(event.target.files ?? []))} /><Button type="button" variant="outline" className="w-fit" onClick={() => requestAttachmentInput.current?.click()}><Paperclip className="size-4" aria-hidden="true" /> Attach files</Button>{requestAttachments.map((file) => <p key={`${file.name}-${file.lastModified}`} className="text-xs text-muted-foreground">Ready to submit: {file.name}</p>)}</div><Button className="self-start" onClick={submit} disabled={!name.trim() || !email.trim() || !subject.trim()}>{resubmissionOfTicketId ? 'Resubmit for review' : 'Submit for review'}</Button></CardContent></Card><Card className="h-fit"><CardHeader><CardTitle className="text-base">What happens next</CardTitle></CardHeader><CardContent><ol className="space-y-4 text-sm text-muted-foreground">{['You submit a clear request.', 'Our team reviews its scope and impact.', 'You approve the proposed scope when needed.', 'Approved work is added to the delivery board.'].map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>{step}</li>)}</ol></CardContent></Card></div></TabsContent>
      <TabsContent value="import" className="mt-0"><ClientImportPanel project={project} submitterName={name.trim() || 'Client'} submitterEmail={email.trim() || 'client@example.com'} /></TabsContent>
    </Tabs>
  </main></PortalShell>
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-background"><header className="border-b border-border bg-card/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Waypoints className="size-4" /></span><span className="font-bold tracking-tight text-foreground">Connectio</span></Link><span className="text-sm text-muted-foreground">Client portal</span></div></header>{children}</div>
}
