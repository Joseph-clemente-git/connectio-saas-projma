import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2,
  ChevronRight,
  FolderInput,
  Library,
  Loader2,
  Pencil,
  Plus,
  Route,
  Settings2,
  Trash2,
} from 'lucide-react'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ProjectOperatingModel } from '@/components/project/project-operating-model'
import { WorkflowSetEditor } from '@/components/project/workflow-set-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { canManageOrg } from '@/lib/permissions'
import { useOrgMemberRole, useOrgMembersWithUsers } from '@/hooks/use-session-data'
import {
  DEFAULT_TERMINOLOGY,
  stagesForPreset,
  terminologyForPreset,
  WORKFLOW_PRESETS,
} from '@/lib/project-workflow'
import type { WorkflowSet, WorkflowStage, WorkspaceTerminology } from '@/types/domain'

const TERMINOLOGY_FIELDS: { key: keyof WorkspaceTerminology; label: string }[] = [
  { key: 'workItem', label: 'Work item' },
  { key: 'workItemPlural', label: 'Work items' },
  { key: 'timebox', label: 'Timebox' },
  { key: 'timeboxPlural', label: 'Timeboxes' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'milestonePlural', label: 'Milestones' },
  { key: 'issue', label: 'Issue' },
  { key: 'release', label: 'Release update' },
]

type SettingsView = 'templates' | 'custom'
type PendingAction = 'save' | 'apply' | 'delete' | null

export function SettingsWorkflowsPage() {
  const { org, user } = useOutletContext<TenantOutletContext>()
  const projects = useLiveQuery(() => db.projects.where('orgId').equals(org.id).toArray(), [org.id])
  const workflowSets = useLiveQuery(() => db.workflowSets.where('orgId').equals(org.id).sortBy('name'), [org.id])
  const members = useOrgMembersWithUsers(org.id)
  const membership = useOrgMemberRole(org.id, user.id)
  const canManage = canManageOrg(membership)

  const [activeView, setActiveView] = useState<SettingsView>('templates')
  const [selectedSetId, setSelectedSetId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [applyProjectId, setApplyProjectId] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSet | null>(null)
  const [setName, setSetName] = useState('')
  const [setDescription, setSetDescription] = useState('')
  const [setPreset, setSetPreset] = useState('general')
  const [setStages, setSetStages] = useState<WorkflowStage[]>(stagesForPreset('general'))
  const [setTerminology, setSetTerminology] = useState<WorkspaceTerminology>(DEFAULT_TERMINOLOGY)
  const [notice, setNotice] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const selectedSet = workflowSets?.find((set) => set.id === selectedSetId) ?? workflowSets?.[0]
  const selectedProject = projects?.find((item) => item.id === projectId) ?? projects?.[0]
  const selectedUseCount = selectedSet
    ? projects?.filter((project) => project.workflowSetId === selectedSet.id).length ?? 0
    : 0
  const projectSource = workflowSets?.find((set) => set.id === selectedProject?.workflowSetId)

  function openEditor(set?: WorkflowSet) {
    setEditingSetId(set?.id ?? null)
    setSetName(set?.name ?? '')
    setSetDescription(set?.description ?? '')
    setSetPreset('general')
    setSetStages((set?.workflowStages ?? stagesForPreset('general')).map((stage) => ({ ...stage })))
    setSetTerminology({ ...(set?.terminology ?? DEFAULT_TERMINOLOGY) })
    setEditorOpen(true)
  }

  function changePreset(preset: string) {
    setSetPreset(preset)
    setSetStages(stagesForPreset(preset))
    setSetTerminology({ ...terminologyForPreset(preset) })
  }

  async function saveSet() {
    const name = setName.trim()
    const workflowStages = setStages
      .map((stage) => ({ ...stage, name: stage.name.trim() }))
      .filter((stage) => stage.name)
    if (!name || workflowStages.length === 0) return

    setPendingAction('save')
    try {
      const now = new Date().toISOString()
      if (editingSetId) {
        let updatedProjects = 0
        await db.transaction('rw', db.workflowSets, db.projects, async () => {
          await db.workflowSets.update(editingSetId, {
            name,
            description: setDescription.trim() || undefined,
            workflowStages,
            terminology: setTerminology,
            updatedAt: now,
          })
          await db.projects
            .where('orgId')
            .equals(org.id)
            .filter((project) => project.workflowSetId === editingSetId)
            .modify((project) => {
              project.workflowStages = workflowStages.map((stage) => ({ ...stage }))
              project.terminology = { ...setTerminology }
              updatedProjects += 1
            })
        })
        setSelectedSetId(editingSetId)
        setNotice(`${name} updated${updatedProjects ? ` across ${updatedProjects} linked ${updatedProjects === 1 ? 'project' : 'projects'}` : ''}.`)
      } else {
        const id = crypto.randomUUID()
        await db.workflowSets.add({
          id,
          orgId: org.id,
          name,
          description: setDescription.trim() || undefined,
          workflowStages,
          terminology: setTerminology,
          createdAt: now,
          updatedAt: now,
        })
        setSelectedSetId(id)
        setNotice(`${name} created and ready to reuse.`)
      }
      setEditorOpen(false)
    } finally {
      setPendingAction(null)
    }
  }

  async function applySet() {
    if (!selectedSet || !applyProjectId) return
    const target = projects?.find((project) => project.id === applyProjectId)
    if (!target) return

    setPendingAction('apply')
    try {
      await db.projects.update(target.id, {
        workflowSetId: selectedSet.id,
        workflowStages: selectedSet.workflowStages.map((stage) => ({ ...stage })),
        terminology: { ...(selectedSet.terminology ?? target.terminology ?? DEFAULT_TERMINOLOGY) },
      })
      setProjectId(target.id)
      setNotice(`${target.name} is now linked to ${selectedSet.name}.`)
    } finally {
      setPendingAction(null)
    }
  }

  async function deleteSet() {
    if (!deleteTarget) return
    setPendingAction('delete')
    try {
      await db.transaction('rw', db.workflowSets, db.projects, async () => {
        await db.projects
          .where('orgId')
          .equals(org.id)
          .filter((project) => project.workflowSetId === deleteTarget.id)
          .modify({ workflowSetId: undefined })
        await db.workflowSets.delete(deleteTarget.id)
      })
    setNotice(`${deleteTarget.name} deleted. Its linked projects are now custom.`)
      if (selectedSetId === deleteTarget.id) setSelectedSetId('')
      setDeleteTarget(null)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title="Project settings"
        description="Use shared templates across projects, or detach a project when it needs custom settings."
        actions={activeView === 'templates' && canManage
          ? <Button onClick={() => openEditor()}><Plus aria-hidden="true" /> New template</Button>
          : undefined}
      />

      <Tabs value={activeView} onValueChange={(value) => { setActiveView(value as SettingsView); setNotice('') }} className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card px-4 sm:px-6">
          <TabsList aria-label="Project settings sections" className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 sm:w-auto">
            <TabsTrigger value="templates" className="min-h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Library aria-hidden="true" className="size-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="custom" className="min-h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Settings2 aria-hidden="true" className="size-4" /> Custom settings
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 sm:p-6">
          {notice && (
            <div role="status" aria-live="polite" className="mb-5 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" /> {notice}
            </div>
          )}

          <TabsContent value="templates" className="mt-0 min-w-0 flex-1">
            {!workflowSets ? null : workflowSets.length === 0 ? (
              <Card>
                <CardContent className="p-6 sm:p-10">
                  <EmptyState
                    icon={Library}
                    title="Create your first reusable template"
                    description="Projects linked to a template stay synchronized when the template changes."
                    actionLabel={canManage ? 'Create template' : undefined}
                    onAction={canManage ? () => openEditor() : undefined}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card className="h-fit overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/20 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                      <CardTitle className="text-base">Templates</CardTitle>
                        <CardDescription className="mt-1">{workflowSets.length} reusable {workflowSets.length === 1 ? 'template' : 'templates'}</CardDescription>
                      </div>
                      {canManage && <Button variant="ghost" size="icon" aria-label="Create reusable template" onClick={() => openEditor()}><Plus aria-hidden="true" /></Button>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-2">
                    {workflowSets.map((set) => {
                      const useCount = projects?.filter((project) => project.workflowSetId === set.id).length ?? 0
                      const active = selectedSet?.id === set.id
                      return (
                        <button
                          key={set.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => { setSelectedSetId(set.id); setApplyProjectId(''); setNotice('') }}
                          className={`flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:bg-muted/60'}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{set.name}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{set.workflowStages.length} stages · {useCount} {useCount === 1 ? 'project' : 'projects'}</span>
                          </span>
                          <ChevronRight aria-hidden="true" className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>

                {selectedSet && (
                  <div className="min-w-0 space-y-5">
                    <Card>
                      <CardHeader className="gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-xl">{selectedSet.name}</CardTitle>
                            <Badge variant="secondary">Template</Badge>
                            <Badge variant="outline">{selectedUseCount} {selectedUseCount === 1 ? 'project' : 'projects'}</Badge>
                          </div>
                          <CardDescription className="mt-2 max-w-2xl leading-relaxed">{selectedSet.description || 'No description provided.'}</CardDescription>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditor(selectedSet)}><Pencil aria-hidden="true" /> Edit</Button>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${selectedSet.name}`} onClick={() => setDeleteTarget(selectedSet)}><Trash2 aria-hidden="true" className="text-destructive" /></Button>
                          </div>
                        )}
                      </CardHeader>
                    </Card>

                    <Card className="border-primary/20">
                      <CardContent className="p-5 sm:p-6">
                        <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)_auto]">
                          <div>
                            <div className="flex items-center gap-2"><FolderInput aria-hidden="true" className="size-5 text-primary" /><h2 className="font-semibold text-foreground">Link template to project</h2></div>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">The project will use this template and receive future template updates. Editing the project directly will detach it as custom.</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="apply-set-project">Project</Label>
                            <Select value={applyProjectId} onValueChange={setApplyProjectId} disabled={!canManage || pendingAction === 'apply'}>
                              <SelectTrigger id="apply-set-project"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                              <SelectContent>{projects?.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <Button onClick={() => void applySet()} disabled={!canManage || !applyProjectId || pendingAction === 'apply'}>
                            {pendingAction === 'apply' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FolderInput aria-hidden="true" />}
                            {pendingAction === 'apply' ? 'Linking…' : 'Link template'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Workflow</CardTitle><CardDescription>Stages are copied in this order.</CardDescription></CardHeader>
                        <CardContent>
                          <ol className="space-y-1">
                            {selectedSet.workflowStages.map((stage, index) => (
                              <li key={stage.id} className="relative flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
                                {index < selectedSet.workflowStages.length - 1 && <span aria-hidden="true" className="absolute left-[21px] top-10 h-7 w-px bg-border" />}
                                <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-card text-xs font-semibold text-primary">{index + 1}</span>
                                <div className="min-w-0"><p className="text-sm font-medium text-foreground">{stage.name}</p>{stage.description && <p className="mt-0.5 text-xs text-muted-foreground">{stage.description}</p>}</div>
                                {stage.requiresReview && <Badge variant="outline" className="ml-auto shrink-0">Review</Badge>}
                              </li>
                            ))}
                          </ol>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-base">Terminology</CardTitle><CardDescription>Labels teams see throughout the project.</CardDescription></CardHeader>
                        <CardContent>
                          <dl className="divide-y divide-border">
                            {TERMINOLOGY_FIELDS.map(({ key, label }) => (
                              <div key={key} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="text-right font-medium text-foreground">{(selectedSet.terminology ?? DEFAULT_TERMINOLOGY)[key]}</dd>
                              </div>
                            ))}
                          </dl>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="mt-0 min-w-0 flex-1">
            {!projects ? null : projects.length === 0 ? (
              <Card><CardContent className="p-6 sm:p-10"><EmptyState icon={Route} title="No projects yet" description="Create a project before configuring project-specific settings." /></CardContent></Card>
            ) : selectedProject && (
              <div className="space-y-5">
                <Card>
                  <CardContent className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:items-end">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-foreground">Custom project settings</h2><Badge variant={projectSource ? 'secondary' : 'outline'}>{projectSource ? `Using template: ${projectSource.name}` : 'Custom'}</Badge></div>
                      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{projectSource ? 'This project currently stays synchronized with its template. The first direct workflow or terminology edit will detach it and make the settings custom.' : 'These settings belong only to this project and do not affect any reusable template.'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="settings-project">Project</Label>
                      <Select value={selectedProject.id} onValueChange={setProjectId}>
                        <SelectTrigger id="settings-project"><SelectValue /></SelectTrigger>
                        <SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="workflow" className="min-w-0 space-y-4">
                  <TabsList aria-label="Project override sections" className="max-w-full justify-start overflow-x-auto">
                    <TabsTrigger value="workflow">Custom workflow</TabsTrigger>
                    <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
                    <TabsTrigger value="terminology">Terminology</TabsTrigger>
                  </TabsList>
                  <TabsContent value="workflow"><ProjectOperatingModel project={selectedProject} members={members?.map(({ user: member }) => member) ?? []} canManage={canManage || selectedProject.leadId === user.id} section="workflow" /></TabsContent>
                  <TabsContent value="responsibilities"><ProjectOperatingModel project={selectedProject} members={members?.map(({ user: member }) => member) ?? []} canManage={canManage || selectedProject.leadId === user.id} section="responsibilities" /></TabsContent>
                  <TabsContent value="terminology"><ProjectOperatingModel project={selectedProject} members={members?.map(({ user: member }) => member) ?? []} canManage={canManage || selectedProject.leadId === user.id} section="terminology" /></TabsContent>
                </Tabs>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={editorOpen} onOpenChange={(open) => { if (pendingAction !== 'save') setEditorOpen(open) }}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingSetId ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>Projects linked to this template stay synchronized with its workflow and terminology.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90dvh-13rem)] space-y-5 overflow-y-auto pr-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-set-name">Name <span className="text-destructive">*</span></Label>
                <Input id="settings-set-name" autoFocus value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="Client delivery standard" />
                <p className="text-xs text-muted-foreground">Use a name that explains when teams should choose this template.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-set-description">Description</Label>
                <textarea id="settings-set-description" value={setDescription} onChange={(event) => setSetDescription(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20" placeholder="For projects that need client review before delivery." />
              </div>
              {!editingSetId && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="settings-starting-template">Starting template</Label>
                  <Select value={setPreset} onValueChange={changePreset}>
                    <SelectTrigger id="settings-starting-template"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(WORKFLOW_PRESETS).map(([value, preset]) => <SelectItem key={value} value={value}>{preset.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Tabs defaultValue="workflow" className="space-y-4">
              <TabsList aria-label="Template fields" className="w-full justify-start">
                <TabsTrigger value="workflow">Workflow ({setStages.length})</TabsTrigger>
                <TabsTrigger value="terminology">Terminology</TabsTrigger>
              </TabsList>
              <TabsContent value="workflow" className="rounded-xl border border-border p-4"><WorkflowSetEditor stages={setStages} onChange={setSetStages} /></TabsContent>
              <TabsContent value="terminology" className="rounded-xl border border-border p-4">
                <div className="mb-4"><h3 className="text-sm font-semibold text-foreground">Project terminology</h3><p className="mt-1 text-xs text-muted-foreground">These labels stay synchronized across every project linked to this template.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {TERMINOLOGY_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`set-term-${key}`}>{label}</Label>
                      <Input id={`set-term-${key}`} value={setTerminology[key]} onChange={(event) => setSetTerminology((current) => ({ ...current, [key]: event.target.value }))} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={pendingAction === 'save'}>Cancel</Button>
            <Button onClick={() => void saveSet()} disabled={pendingAction === 'save' || !setName.trim() || setStages.length === 0 || setStages.some((stage) => !stage.name.trim()) || TERMINOLOGY_FIELDS.some(({ key }) => !setTerminology[key].trim())}>
              {pendingAction === 'save' && <Loader2 aria-hidden="true" className="animate-spin" />}
              {pendingAction === 'save' ? 'Saving…' : editingSetId ? 'Save template' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && pendingAction !== 'delete') setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>Linked projects will keep their last workflow and terminology as custom settings.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pendingAction === 'delete'}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteSet()} disabled={pendingAction === 'delete'}>
              {pendingAction === 'delete' && <Loader2 aria-hidden="true" className="animate-spin" />}
              {pendingAction === 'delete' ? 'Deleting…' : 'Delete template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
