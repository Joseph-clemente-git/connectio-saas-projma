import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ExternalLink, FileText, Link2, Megaphone, MessageSquareText, Paperclip, Pin, SquareCheckBig } from 'lucide-react'
import { db } from '@/db/schema'
import type { AnnouncementAudience, PinKind, User } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = { orgId: string; currentUser: User; workspaceId?: string; projectId?: string; canAnnounce: boolean }
type AnnouncementAlertProps = Pick<Props, 'workspaceId' | 'projectId'>
const PIN_TYPES: { value: PinKind; label: string }[] = [
  { value: 'link', label: 'Link' }, { value: 'file', label: 'File' }, { value: 'task', label: 'Task' }, { value: 'message', label: 'Message' }, { value: 'note', label: 'Note' },
]
const audienceLabels: Record<AnnouncementAudience, string> = { all_members: 'All members', managers: 'Managers', project_members: 'Project members' }
const pinIcons = { link: Link2, file: FileText, task: SquareCheckBig, message: MessageSquareText, note: Pin, announcement: Megaphone }
const inputClass = 'flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

/** A persistent page-level announcement area. Creation and management remain in the Pinned tab. */
export function AnnouncementsAlert({ workspaceId, projectId }: AnnouncementAlertProps) {
  const announcements = useLiveQuery(
    () => workspaceId
      ? db.announcements.where('workspaceId').equals(workspaceId).toArray()
      : projectId ? db.announcements.where('projectId').equals(projectId).toArray() : [],
    [workspaceId, projectId],
  )
  const now = new Date()
  const active = announcements
    ?.filter((item) => new Date(item.publishAt) <= now && (!item.expiresAt || new Date(item.expiresAt) >= now))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime())

  if (!active?.length) return null

  return (
    <section aria-labelledby="active-announcements-heading" className="border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Megaphone aria-hidden="true" className="size-3.5 text-primary" />
        <h2 id="active-announcements-heading">Announcements</h2>
        <span aria-label={`${active.length} active announcements`} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{active.length}</span>
      </div>
      <div className="space-y-2">
        {active.map((item) => (
          <article key={item.id} role="note" className="border-l-4 border-primary bg-primary/[0.045] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  {item.pinned && <Badge className="h-5 px-1.5 text-[10px]"><Pin aria-hidden="true" className="size-2.5" />Pinned</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground/80">{item.content}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{audienceLabels[item.audience]}</Badge>
                <span>Published {format(new Date(item.publishAt), 'MMM d')}</span>
              </div>
            </div>
            {(item.links.length > 0 || item.attachments.length > 0 || item.expiresAt) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                {item.links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex max-w-full items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"><ExternalLink aria-hidden="true" className="size-3 shrink-0" /><span className="max-w-64 truncate">{url}</span></a>)}
                {item.attachments.map((name) => <span key={name} className="flex items-center gap-1 text-muted-foreground"><Paperclip aria-hidden="true" className="size-3" />{name}</span>)}
                {item.expiresAt && <span className="text-muted-foreground">Expires {format(new Date(item.expiresAt), 'MMM d, yyyy · h:mm a')}</span>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export function PinsAndAnnouncements({ orgId, currentUser, workspaceId, projectId, canAnnounce }: Props) {
  const scope = workspaceId ? 'workspace' : 'project'
  const [pinOpen, setPinOpen] = useState(false)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState(''); const [pinDescription, setPinDescription] = useState(''); const [pinUrl, setPinUrl] = useState(''); const [pinKind, setPinKind] = useState<PinKind>('link')
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [attachments, setAttachments] = useState(''); const [links, setLinks] = useState(''); const [publishAt, setPublishAt] = useState(''); const [expiresAt, setExpiresAt] = useState(''); const [audience, setAudience] = useState<AnnouncementAudience>('all_members'); const [pinned, setPinned] = useState(true)
  const pins = useLiveQuery(() => workspaceId ? db.pins.where('workspaceId').equals(workspaceId).reverse().sortBy('createdAt') : projectId ? db.pins.where('projectId').equals(projectId).reverse().sortBy('createdAt') : [], [workspaceId, projectId])
  const announcements = useLiveQuery(() => workspaceId ? db.announcements.where('workspaceId').equals(workspaceId).toArray() : projectId ? db.announcements.where('projectId').equals(projectId).toArray() : [], [workspaceId, projectId])
  const now = new Date()
  const visibleAnnouncements = announcements?.filter((item) => new Date(item.publishAt) <= now && (!item.expiresAt || new Date(item.expiresAt) >= now)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime())
  const resetPin = () => { setPinTitle(''); setPinDescription(''); setPinUrl(''); setPinKind('link') }
  const resetAnnouncement = () => { setTitle(''); setContent(''); setAttachments(''); setLinks(''); setPublishAt(''); setExpiresAt(''); setAudience('all_members'); setPinned(true) }
  async function createPin() { if (!pinTitle.trim()) return; await db.pins.add({ id: crypto.randomUUID(), orgId, ...(workspaceId ? { workspaceId } : { projectId }), kind: pinKind, title: pinTitle.trim(), description: pinDescription.trim() || undefined, url: pinUrl.trim() || undefined, createdById: currentUser.id, createdAt: new Date().toISOString() }); setPinOpen(false); resetPin() }
  async function createAnnouncement() { if (!title.trim() || !content.trim()) return; await db.announcements.add({ id: crypto.randomUUID(), orgId, ...(workspaceId ? { workspaceId } : { projectId }), title: title.trim(), content: content.trim(), attachments: attachments.split('\n').map((x) => x.trim()).filter(Boolean), links: links.split('\n').map((x) => x.trim()).filter(Boolean), publishAt: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined, audience, pinned, createdById: currentUser.id, createdAt: new Date().toISOString() }); setAnnouncementOpen(false); resetAnnouncement() }
  return <section className="space-y-8 p-6" aria-label={`${scope} pins and announcements`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Pin className="size-5 text-primary" />Pinned & announcements</h2><p className="mt-1 text-sm text-muted-foreground">Keep important updates and resources visible to the right people.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setPinOpen(true)}><Pin /> Pin item</Button>{canAnnounce && <Button onClick={() => setAnnouncementOpen(true)}><Megaphone /> New announcement</Button>}</div></div>
    <div><div className="mb-3 flex items-center gap-2"><Megaphone className="size-4 text-primary" /><h3 className="font-semibold">Announcements</h3></div>{visibleAnnouncements?.length ? <div className="grid gap-4 lg:grid-cols-2">{visibleAnnouncements.map((item) => <Card key={item.id} className={item.pinned ? 'border-primary/30 bg-primary/[0.03]' : ''}><CardHeader className="gap-2"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{item.title}</CardTitle><div className="flex shrink-0 gap-1">{item.pinned && <Badge><Pin className="size-3" /> Pinned</Badge>}<Badge variant="secondary">{audienceLabels[item.audience]}</Badge></div></div><p className="text-xs text-muted-foreground">Published {format(new Date(item.publishAt), 'MMM d, yyyy · h:mm a')}{item.expiresAt && ` · Expires ${format(new Date(item.expiresAt), 'MMM d, yyyy')}`}</p></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.content}</p>{item.links.length > 0 && <div className="mt-4 space-y-1.5">{item.links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex w-fit max-w-full items-center gap-1 text-sm text-primary hover:underline"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">{url}</span></a>)}</div>}{item.attachments.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{item.attachments.map((name) => <Badge key={name} variant="outline"><Paperclip className="size-3" />{name}</Badge>)}</div>}</CardContent></Card>)}</div> : <Card className="border-dashed"><CardContent className="py-8 text-center"><Megaphone className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-medium">No active announcements</p><p className="mt-1 text-sm text-muted-foreground">{canAnnounce ? 'Post an update to keep this group aligned.' : 'Updates from authorized members will appear here.'}</p></CardContent></Card>}</div>
    <div><div className="mb-3 flex items-center gap-2"><Pin className="size-4 text-primary" /><h3 className="font-semibold">Pinned resources</h3></div>{pins?.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pins.map((item) => { const Icon = pinIcons[item.kind]; return <Card key={item.id}><CardContent className="flex gap-3 p-4"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="font-medium">{item.title}</p>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 flex w-fit max-w-full items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="size-3 shrink-0" /><span className="truncate">Open resource</span></a>}</div></CardContent></Card> })}</div> : <Card className="border-dashed"><CardContent className="py-8 text-center"><Pin className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-medium">Nothing pinned yet</p><p className="mt-1 text-sm text-muted-foreground">Pin links, files, tasks, messages, and notes for quick access.</p></CardContent></Card>}</div>
    <Dialog open={pinOpen} onOpenChange={(open) => { setPinOpen(open); if (!open) resetPin() }}><DialogContent><DialogHeader><DialogTitle>Pin a resource</DialogTitle><DialogDescription>Add a visible shortcut for this {scope}.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Resource type</Label><Select value={pinKind} onValueChange={(value) => setPinKind(value as PinKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PIN_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="pin-title">Title</Label><Input id="pin-title" value={pinTitle} onChange={(e) => setPinTitle(e.target.value)} placeholder="Q3 planning brief" /></div><div className="space-y-2"><Label htmlFor="pin-description">Context</Label><textarea id="pin-description" value={pinDescription} onChange={(e) => setPinDescription(e.target.value)} rows={3} className={inputClass} placeholder="Why this resource matters" /></div><div className="space-y-2"><Label htmlFor="pin-url">Link (optional)</Label><Input id="pin-url" type="url" value={pinUrl} onChange={(e) => setPinUrl(e.target.value)} placeholder="https://..." /></div></div><DialogFooter><Button variant="outline" onClick={() => setPinOpen(false)}>Cancel</Button><Button onClick={createPin} disabled={!pinTitle.trim()}>Pin resource</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={announcementOpen} onOpenChange={(open) => { setAnnouncementOpen(open); if (!open) resetAnnouncement() }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>New {scope} announcement</DialogTitle><DialogDescription>Choose who sees it and when it should stop appearing.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="announcement-title">Title</Label><Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project Kickoff Meeting" /></div><div className="space-y-2"><Label htmlFor="announcement-content">Content</Label><textarea id="announcement-content" value={content} onChange={(e) => setContent(e.target.value)} rows={5} className={inputClass} placeholder="August 28, 2026 — 2:00 PM&#10;All project members are required to attend." /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="announcement-publish">Publish date</Label><Input id="announcement-publish" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="announcement-expiry">Expiration date</Label><Input id="announcement-expiry" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div></div><div className="space-y-2"><Label>Target audience</Label><Select value={audience} onValueChange={(value) => setAudience(value as AnnouncementAudience)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_members">All members</SelectItem><SelectItem value="managers">Managers</SelectItem>{projectId && <SelectItem value="project_members">Project members</SelectItem>}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="announcement-links">Links</Label><textarea id="announcement-links" value={links} onChange={(e) => setLinks(e.target.value)} rows={2} className={inputClass} placeholder="One https:// link per line" /></div><div className="space-y-2"><Label htmlFor="announcement-attachments">Attachments</Label><textarea id="announcement-attachments" value={attachments} onChange={(e) => setAttachments(e.target.value)} rows={2} className={inputClass} placeholder="One attachment name per line" /></div><label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Checkbox checked={pinned} onCheckedChange={(checked) => setPinned(checked === true)} />Pin this announcement</label></div><DialogFooter><Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button><Button onClick={createAnnouncement} disabled={!title.trim() || !content.trim()}>Publish announcement</Button></DialogFooter></DialogContent></Dialog>
  </section>
}
