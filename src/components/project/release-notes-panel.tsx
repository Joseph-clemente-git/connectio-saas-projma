import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { CheckSquare, ExternalLink, FileImage, FileText, Milestone, Plus, Send, Sparkles } from 'lucide-react'
import { db } from '@/db/schema'
import type { ReleaseNoteStatus, User } from '@/types/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isFinalStage } from '@/lib/project-workflow'

type Props = {
  orgId: string
  currentUser: User
  workspaceId: string
  projectId?: string
  canManage: boolean
}

const inputClass = 'flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'
const statusLabel: Record<ReleaseNoteStatus, string> = { draft: 'Draft', published: 'Published' }

/** General work-completion updates: launches, handoffs, phase completions, and releases. */
export function ReleaseNotesPanel({ orgId, currentUser, workspaceId, projectId, canManage }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? 'workspace')
  const [relatedTaskIds, setRelatedTaskIds] = useState<string[]>([])
  const [relatedMilestoneIds, setRelatedMilestoneIds] = useState<string[]>([])
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  const [links, setLinks] = useState('')
  const [status, setStatus] = useState<ReleaseNoteStatus>('published')

  const notes = useLiveQuery(
    () => projectId
      ? db.releaseNotes.where('projectId').equals(projectId).reverse().sortBy('date')
      : db.releaseNotes.where('workspaceId').equals(workspaceId).reverse().sortBy('date'),
    [workspaceId, projectId],
  )
  const projects = useLiveQuery(() => db.projects.where('workspaceId').equals(workspaceId).toArray(), [workspaceId])
  const selectedProject = selectedProjectId === 'workspace' ? undefined : selectedProjectId
  const tasks = useLiveQuery(async () => {
    const ids = selectedProject ? [selectedProject] : (projects ?? []).map((project) => project.id)
    return ids.length ? db.tasks.where('projectId').anyOf(ids).toArray() : []
  }, [selectedProject, projects])
  const milestones = useLiveQuery(async () => {
    const ids = selectedProject ? [selectedProject] : (projects ?? []).map((project) => project.id)
    return ids.length ? db.milestones.where('projectId').anyOf(ids).toArray() : []
  }, [selectedProject, projects])
  const files = useLiveQuery(
    () => projectId
      ? db.files.where('projectId').equals(projectId).toArray()
      : db.files.where('workspaceId').equals(workspaceId).toArray(),
    [workspaceId, projectId],
  )
  const authors = useLiveQuery(async () => {
    const ids = [...new Set((notes ?? []).map((note) => note.authorId))]
    const users = await db.users.bulkGet(ids)
    return new Map(users.filter((user): user is User => Boolean(user)).map((user) => [user.id, user]))
  }, [notes])
  const projectNames = useMemo(() => new Map((projects ?? []).map((project) => [project.id, project.name])), [projects])
  const taskNames = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task.title])), [tasks])
  const eligibleTasks = useMemo(() => (tasks ?? []).filter((task) => {
    const project = projects?.find((item) => item.id === task.projectId)
    return task.reviewState === 'approved' || Boolean(project && isFinalStage(project, task.status))
  }), [tasks, projects])
  const eligibleTaskIds = useMemo(() => new Set(eligibleTasks.map((task) => task.id)), [eligibleTasks])
  const milestoneNames = useMemo(() => new Map((milestones ?? []).map((milestone) => [milestone.id, milestone.name])), [milestones])
  const fileById = useMemo(() => new Map((files ?? []).map((file) => [file.id, file])), [files])

  const reset = () => {
    setTitle(''); setDescription(''); setDate(new Date().toISOString().slice(0, 10)); setSelectedProjectId(projectId ?? 'workspace')
    setRelatedTaskIds([]); setRelatedMilestoneIds([]); setAttachmentIds([]); setLinks(''); setStatus('published')
  }
  const toggle = (value: string, setValues: React.Dispatch<React.SetStateAction<string[]>>) => setValues((values) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  const changeProject = (value: string) => {
    setSelectedProjectId(value); setRelatedTaskIds([]); setRelatedMilestoneIds([])
  }
  async function save() {
    if (!canManage) return
    if (!title.trim() || !description.trim()) return
    const selectedFiles = (files ?? []).filter((file) => attachmentIds.includes(file.id))
    const now = new Date().toISOString()
    await db.releaseNotes.add({
      id: crypto.randomUUID(), orgId, workspaceId, projectId: selectedProject, title: title.trim(), description: description.trim(),
      date: new Date(date).toISOString(), relatedTaskIds: relatedTaskIds.filter((id) => eligibleTaskIds.has(id)), relatedMilestoneIds,
      fileIds: selectedFiles.filter((file) => !file.mimeType?.startsWith('image/')).map((file) => file.id),
      imageIds: selectedFiles.filter((file) => file.mimeType?.startsWith('image/')).map((file) => file.id),
      links: links.split('\n').map((link) => link.trim()).filter(Boolean), authorId: currentUser.id, status, createdAt: now, updatedAt: now,
    })
    setOpen(false); reset()
  }

  return <section className="space-y-6 p-6" aria-labelledby="release-updates-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="release-updates-heading" className="flex items-center gap-2 text-lg font-semibold"><Sparkles aria-hidden="true" className="size-5 text-primary" />Release updates</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Record meaningful work moments—completed phases, launches, handoffs, production upgrades, and version releases.</p></div>
      {canManage && <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" />New update</Button>}
    </div>

    {notes?.length ? <div className="space-y-4">{notes.map((note) => {
      const attachedFiles = [...note.fileIds, ...note.imageIds].map((id) => fileById.get(id)).filter(Boolean)
      return <Card key={note.id} className={note.status === 'draft' ? 'border-dashed' : ''}><CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{note.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{format(new Date(note.date), 'MMM d, yyyy')} · {note.projectId ? projectNames.get(note.projectId) ?? 'Project' : 'Workspace-wide'} · {authors?.get(note.authorId)?.name ?? 'Unknown author'}</p></div><Badge variant={note.status === 'published' ? 'success' : 'secondary'}>{statusLabel[note.status]}</Badge></div>
      </CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{note.description}</p>
        {(note.relatedTaskIds.length > 0 || note.relatedMilestoneIds.length > 0 || attachedFiles.length > 0 || note.links.length > 0) && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
          {note.relatedTaskIds.map((id) => <Badge key={id} variant="outline"><CheckSquare aria-hidden="true" className="size-3" />{taskNames.get(id) ?? 'Related task'}</Badge>)}
          {note.relatedMilestoneIds.map((id) => <Badge key={id} variant="outline"><Milestone aria-hidden="true" className="size-3" />{milestoneNames.get(id) ?? 'Related milestone'}</Badge>)}
          {attachedFiles.map((file) => <Badge key={file!.id} variant="outline">{file!.mimeType?.startsWith('image/') ? <FileImage aria-hidden="true" className="size-3" /> : <FileText aria-hidden="true" className="size-3" />}{file!.name}</Badge>)}
          {note.links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="flex max-w-full items-center gap-1 rounded-md px-1 text-primary hover:underline"><ExternalLink aria-hidden="true" className="size-3 shrink-0" /><span className="max-w-56 truncate">{link}</span></a>)}
        </div>}
      </CardContent></Card>
    })}</div> : <EmptyState icon={Sparkles} title="No release updates yet" description={canManage ? 'Capture the next completed phase, launch, handoff, or other delivery moment.' : 'Published delivery updates will appear here.'} actionLabel={canManage ? 'New update' : undefined} onAction={canManage ? () => setOpen(true) : undefined} />}

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset() }}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>New release update</DialogTitle><DialogDescription>This can describe any project or work completion—not only a software release. The author is recorded as {currentUser.name}.</DialogDescription></DialogHeader>
      <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="release-title">Title</Label><Input id="release-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Building Phase 2 Completion" /></div><div className="space-y-2"><Label htmlFor="release-date">Date</Label><Input id="release-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="release-description">Description</Label><textarea id="release-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className={inputClass} placeholder="What was completed, launched, handed over, or changed?" /></div>
        {!projectId && <div className="space-y-2"><Label>Project</Label><Select value={selectedProjectId} onValueChange={changeProject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="workspace">Workspace-wide update</SelectItem>{projects?.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Workspace: {workspaceId ? 'Current project group' : 'Not selected'}</p></div>}
        <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as ReleaseNoteStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent></Select></div>
        <RelatedRecords label="Related tasks" icon={CheckSquare} records={eligibleTasks} selected={relatedTaskIds} onToggle={(id) => toggle(id, setRelatedTaskIds)} render={(task) => task.title} empty="Only finished or independently approved tasks can be added to a release update." help="Only finished or independently approved tasks can be linked." />
        <RelatedRecords label="Related milestones" icon={Milestone} records={milestones ?? []} selected={relatedMilestoneIds} onToggle={(id) => toggle(id, setRelatedMilestoneIds)} render={(milestone) => milestone.name} empty="No milestones are available for this scope." />
        <RelatedRecords label="Files & images" icon={FileText} records={(files ?? []).filter((file) => file.kind === 'file')} selected={attachmentIds} onToggle={(id) => toggle(id, setAttachmentIds)} render={(file) => `${file.name}${file.mimeType?.startsWith('image/') ? ' (image)' : ''}`} empty="No files are available for this scope." />
        <div className="space-y-2"><Label htmlFor="release-links">Links</Label><textarea id="release-links" value={links} onChange={(event) => setLinks(event.target.value)} rows={2} className={inputClass} placeholder="One https:// link per line" /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!title.trim() || !description.trim()}><Send aria-hidden="true" />{status === 'published' ? 'Publish update' : 'Save draft'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>
}

function RelatedRecords<T extends { id: string }>({ label, icon: Icon, records, selected, onToggle, render, empty, help }: { label: string; icon: typeof CheckSquare; records: T[]; selected: string[]; onToggle: (id: string) => void; render: (record: T) => string; empty: string; help?: string }) {
  return <fieldset className="space-y-2"><legend className="flex items-center gap-2 text-sm font-medium"><Icon aria-hidden="true" className="size-4 text-primary" />{label}</legend>{help && <p className="text-xs text-muted-foreground">{help}</p>}{records.length ? <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{records.map((record) => <label key={record.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selected.includes(record.id)} onCheckedChange={() => onToggle(record.id)} /><span>{render(record)}</span></label>)}</div> : <p className="text-xs text-muted-foreground">{empty}</p>}</fieldset>
}
