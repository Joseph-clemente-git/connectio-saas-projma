import { useState } from 'react'
import { CalendarDays, Pencil, Settings2 } from 'lucide-react'
import { db } from '@/db/schema'
import type { Project, ProjectStatus, User } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectOperatingModel } from '@/components/project/project-operating-model'

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}

type ProjectDraft = Pick<Project, 'name' | 'description' | 'status' | 'color' | 'leadId' | 'coordinatorId' | 'reviewerId' | 'startDate' | 'endDate'>

function draftFor(project: Project): ProjectDraft {
  return {
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    color: project.color,
    leadId: project.leadId,
    coordinatorId: project.coordinatorId,
    reviewerId: project.reviewerId,
    startDate: project.startDate?.slice(0, 10),
    endDate: project.endDate?.slice(0, 10),
  }
}

export function ProjectSettingsPanel({ project, members, canManage }: { project: Project; members: User[]; canManage: boolean }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ProjectDraft>(() => draftFor(project))

  const updateDraft = <K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K]) => setDraft((current) => ({ ...current, [field]: value }))
  const memberValue = (value?: string) => value ?? 'unassigned'
  const updateMember = (field: 'leadId' | 'coordinatorId' | 'reviewerId', value: string) => updateDraft(field, value === 'unassigned' ? undefined : value)

  async function saveProject() {
    const name = draft.name.trim()
    if (!name) return
    setSaving(true)
    try {
      await db.projects.update(project.id, {
        ...draft,
        name,
        description: draft.description?.trim() || undefined,
        startDate: draft.startDate ? new Date(draft.startDate).toISOString() : undefined,
        endDate: draft.endDate ? new Date(draft.endDate).toISOString() : undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Tabs defaultValue="general" className="space-y-5">
        <TabsList aria-label="Project settings sections" className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
          <TabsTrigger value="terminology">Terminology</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 space-y-5">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Settings2 aria-hidden="true" className="size-4 text-primary" /> Project details</CardTitle>
                <CardDescription className="mt-1.5">Name, summary, status, schedule, color, and ownership.</CardDescription>
              </div>
              {canManage && <Button size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Edit project</Button>}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project name</p><p className="mt-1 font-medium text-foreground">{project.name}</p></div>
              <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{project.description || 'No description yet.'}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-1 text-sm text-foreground">{PROJECT_STATUS_LABELS[project.status]}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</p><p className="mt-1 flex items-center gap-2 text-sm text-foreground"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />{project.startDate || project.endDate ? `${project.startDate?.slice(0, 10) ?? 'No start'} – ${project.endDate?.slice(0, 10) ?? 'No end'}` : 'Not scheduled'}</p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="mt-0"><ProjectOperatingModel project={project} members={members} canManage={canManage} section="workflow" /></TabsContent>
        <TabsContent value="responsibilities" className="mt-0"><ProjectOperatingModel project={project} members={members} canManage={canManage} section="responsibilities" /></TabsContent>
        <TabsContent value="terminology" className="mt-0"><ProjectOperatingModel project={project} members={members} canManage={canManage} section="terminology" /></TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={(open) => { if (open) setDraft(draftFor(project)); setEditing(open) }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-6 sm:p-8">
          <DialogHeader><DialogTitle>Edit project</DialogTitle><DialogDescription>Update all project details in one place. Changes are saved only when you choose Save changes.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="project-name">Project name <span className="text-destructive">*</span></Label><Input id="project-name" autoFocus value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="project-description">Description</Label><textarea id="project-description" value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} rows={4} className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20" placeholder="What is this project for?" /></div>
            <div className="space-y-1.5"><Label htmlFor="project-status">Status</Label><Select value={draft.status} onValueChange={(value) => updateDraft('status', value as ProjectStatus)}><SelectTrigger id="project-status"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="project-color">Project color</Label><div className="flex items-center gap-2"><Input id="project-color" type="color" value={draft.color} onChange={(event) => updateDraft('color', event.target.value)} className="h-10 w-14 p-1" /><Input value={draft.color} onChange={(event) => updateDraft('color', event.target.value)} aria-label="Project color hex value" /></div></div>
            <div className="space-y-1.5"><Label htmlFor="project-start-date">Start date</Label><Input id="project-start-date" type="date" value={draft.startDate ?? ''} max={draft.endDate} onChange={(event) => updateDraft('startDate', event.target.value || undefined)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-end-date">End date</Label><Input id="project-end-date" type="date" value={draft.endDate ?? ''} min={draft.startDate} onChange={(event) => updateDraft('endDate', event.target.value || undefined)} /></div>
            {([['leadId', 'Project manager'], ['coordinatorId', 'Work coordinator'], ['reviewerId', 'Default reviewer']] as const).map(([field, label]) => <div key={field} className="space-y-1.5"><Label htmlFor={`project-${field}`}>{label}</Label><Select value={memberValue(draft[field])} onValueChange={(value) => updateMember(field, value)}><SelectTrigger id={`project-${field}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Not assigned</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></div>)}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="button" onClick={() => void saveProject()} disabled={saving || !draft.name.trim()}>{saving ? 'Saving…' : 'Save changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
