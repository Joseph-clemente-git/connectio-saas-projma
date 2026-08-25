import { useState } from 'react'
import { useOutletContext, useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, FolderKanban, Pencil } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LimitButton } from '@/components/shared/limit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useOrgMembersWithUsers, useOrgUsage } from '@/hooks/use-session-data'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { LinksManager } from '@/components/shared/links-manager'
import type { ProjectStatus } from '@/types/domain'
import { WORKFLOW_PRESETS, stagesForPreset, terminologyForPreset, workflowStages } from '@/lib/project-workflow'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileExplorer } from '@/components/files/file-explorer'
import { AnnouncementsAlert, PinsAndAnnouncements } from '@/components/shared/pins-and-announcements'
import { useOrgMemberRole } from '@/hooks/use-session-data'
import { canManageOrg } from '@/lib/permissions'
import { RecurringReportsPanel } from '@/components/shared/recurring-reports-panel'
import { ReleaseNotesPanel } from '@/components/project/release-notes-panel'
import { calculateScheduleHealth, calculateTaskProgress, SCHEDULE_HEALTH_LABEL, SCHEDULE_HEALTH_VARIANT } from '@/lib/schedule-health'
import { WorkspaceProjectOverview } from '@/components/project/workspace-project-overview'

const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  planning: 'secondary',
  active: 'success',
  on_hold: 'warning',
  completed: 'outline',
  archived: 'secondary',
}
const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}
const PROJECT_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2']
const WORKSPACE_VIEW_TIME = Date.now()

export function WorkspaceDetailPage() {
  const { org, plan, user: currentUser } = useOutletContext<TenantOutletContext>()
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const workspace = useLiveQuery(() => (workspaceId ? db.workspaces.get(workspaceId) : undefined), [workspaceId])
  const projects = useLiveQuery(
    () => (workspaceId ? db.projects.where('workspaceId').equals(workspaceId).toArray() : []),
    [workspaceId],
  )
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])
  const workflowSets = useLiveQuery(() => db.workflowSets.where('orgId').equals(org.id).toArray(), [org.id])
  const teams = useLiveQuery(() => db.teams.where('orgId').equals(org.id).toArray(), [org.id])
  const usage = useOrgUsage(org.id)
  const members = useOrgMembersWithUsers(org.id)
  const myMembership = useOrgMemberRole(org.id, currentUser.id)
  const canManage = canManageOrg(myMembership)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workflowPreset, setWorkflowPreset] = useState('general')
  const [reviewerId, setReviewerId] = useState('unassigned')
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTeamId, setEditTeamId] = useState('unassigned')
  const [editWorkflowPreset, setEditWorkflowPreset] = useState('general')
  const [savingWorkspace, setSavingWorkspace] = useState(false)

  async function create() {
    if (!name.trim() || !workspaceId) return
    const projectId = crypto.randomUUID()
    const selectedWorkflowSet = workflowSets?.find((set) => set.id === workflowPreset)
    await db.projects.add({
      id: projectId,
      orgId: org.id,
      workspaceId,
      name: name.trim(),
      description: description.trim() || undefined,
      leadId: currentUser.id,
      coordinatorId: currentUser.id,
      reviewerId: reviewerId === 'unassigned' ? undefined : reviewerId,
      workflowLabels: WORKFLOW_PRESETS[workflowPreset]?.labels,
      workflowSetId: selectedWorkflowSet?.id,
      workflowStages: selectedWorkflowSet?.workflowStages.map((stage) => ({ ...stage })) ?? stagesForPreset(workflowPreset),
      terminology: selectedWorkflowSet?.terminology ?? terminologyForPreset(workflowPreset),
      status: 'planning',
      color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      createdAt: new Date().toISOString(),
    })
    setOpen(false)
    setName('')
    setDescription('')
    setWorkflowPreset('general')
    setReviewerId('unassigned')
    navigate(`../projects/${projectId}?view=settings`)
  }

  function openProjectCreator() {
    if (!workspace) return
    const defaultPreset = WORKFLOW_PRESETS[workspace.workflowPreset ?? ''] ? workspace.workflowPreset! : 'general'
    setName('')
    setDescription('')
    setWorkflowPreset(defaultPreset)
    setReviewerId('unassigned')
    setOpen(true)
  }

  function openWorkspaceEditor() {
    if (!workspace) return
    setEditName(workspace.name)
    setEditDescription(workspace.description ?? '')
    setEditTeamId(workspace.teamId ?? 'unassigned')
    setEditWorkflowPreset(WORKFLOW_PRESETS[workspace.workflowPreset ?? ''] ? workspace.workflowPreset! : 'general')
    setEditOpen(true)
  }

  async function saveWorkspace() {
    if (!workspace || !canManage || !editName.trim()) return
    setSavingWorkspace(true)
    try {
      await db.workspaces.update(workspace.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        teamId: editTeamId === 'unassigned' ? undefined : editTeamId,
        workflowPreset: editWorkflowPreset,
        workflowStages: stagesForPreset(editWorkflowPreset),
        terminology: terminologyForPreset(editWorkflowPreset),
      })
      setEditOpen(false)
    } finally {
      setSavingWorkspace(false)
    }
  }

  if (workspace === undefined) return <LoadingScreen />
  if (!workspace) {
    return (
      <div className="p-6">
        <EmptyState icon={FolderKanban} title="Workspace not found" description="It may have been deleted." />
      </div>
    )
  }
  const workspaceWorkflowPreset = workspace.workflowPreset ?? 'general'

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-1.5 text-base font-medium text-muted-foreground">
            <Link to="../workspaces" className="hover:text-foreground">
              Project groups
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-xl font-bold text-foreground">{workspace.name}</span>
          </span>
        }
        description={workspace.description}
        actions={
          <>
            {canManage && (
              <Button variant="outline" onClick={openWorkspaceEditor}>
                <Pencil aria-hidden="true" className="size-4" />
                Edit workspace
              </Button>
            )}
            <LimitButton
              plan={plan}
              limitKey="projects"
              current={usage?.projects ?? 0}
              label="New project"
              onClick={openProjectCreator}
            />
          </>
        }
      />
      <AnnouncementsAlert workspaceId={workspace.id} />

      <Tabs defaultValue="projects" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-card px-6 py-3"><TabsList><TabsTrigger value="projects">Projects</TabsTrigger><TabsTrigger value="reports">Reports</TabsTrigger><TabsTrigger value="release-notes">Release updates</TabsTrigger><TabsTrigger value="pinned">Pinned</TabsTrigger><TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger></TabsList></div>
      <TabsContent value="projects" className="mt-0 flex-1 overflow-y-auto p-6">
        {projects && projects.length > 0 ? (
          <div className="space-y-8">
            <WorkspaceProjectOverview projects={projects} tasks={allTasks ?? []} />
            <section aria-labelledby="project-details-heading" className="space-y-4">
              <div>
                <h2 id="project-details-heading" className="text-lg font-semibold text-foreground">Project details</h2>
                <p className="mt-1 text-sm text-muted-foreground">Reported status, live delivery signals, and verified progress.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const tasks = allTasks?.filter((task) => task.projectId === p.id) ?? []
              const stages = workflowStages(p)
              const finalStageId = stages.at(-1)?.id ?? 'done'
              const reviewStageIds = new Set(stages.filter((stage) => stage.requiresReview).map((stage) => stage.id))
              const approved = tasks.filter((task) => task.status === finalStageId && (reviewStageIds.size === 0 || task.reviewState === 'approved')).length
              const hasReviewRisk = tasks.some((task) =>
                (reviewStageIds.has(task.status) && (!task.reviewerId || task.reviewerId === task.assigneeId)) ||
                (task.status === finalStageId && reviewStageIds.size > 0 && task.reviewState !== 'approved'),
              )
              const needsAttention = tasks.some((task) =>
                task.status !== finalStageId && (!task.assigneeId || Boolean(task.dueDate && new Date(task.dueDate).getTime() < WORKSPACE_VIEW_TIME)),
              )
              const scheduleHealth = calculateScheduleHealth(p.startDate, p.endDate, calculateTaskProgress(tasks, finalStageId))
              const liveStatus = tasks.length === 0 ? 'Not started' : approved === tasks.length ? 'Complete' : scheduleHealth ? (scheduleHealth.delayPercentage > 0 ? `${scheduleHealth.delayPercentage}% behind schedule` : SCHEDULE_HEALTH_LABEL[scheduleHealth.status]) : hasReviewRisk ? 'Review risk' : needsAttention ? 'Needs attention' : 'On track'
              const liveVariant = scheduleHealth && tasks.length > 0 && approved !== tasks.length
                ? SCHEDULE_HEALTH_VARIANT[scheduleHealth.status]
                : liveStatus === 'Complete' || liveStatus === 'On track' ? 'success' : liveStatus === 'Not started' ? 'secondary' : 'warning'
              return (
              <Link key={p.id} to={`../projects/${p.id}`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={STATUS_VARIANT[p.status]}>Reported: {STATUS_LABEL[p.status]}</Badge>
                    <Badge variant={liveVariant}>Live: {liveStatus}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description ?? 'No description'}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Verified progress</span><span>{approved}/{tasks.length} approved</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${tasks.length ? Math.round((approved / tasks.length) * 100) : 0}%` }} /></div>
                </CardContent>
              </Card>
              </Link>
              )
            })}
              </div>
            </section>
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project in this workspace."
            actionLabel="New project"
            onAction={openProjectCreator}
          />
        )}
      </TabsContent>
      <TabsContent value="files" className="mt-0 flex min-h-0 flex-1"><FileExplorer orgId={org.id} userId={currentUser.id} plan={plan} workspaceId={workspace.id} title={`${workspace.name} files`} /></TabsContent>
      <TabsContent value="reports" className="mt-0 flex-1 overflow-y-auto"><RecurringReportsPanel orgId={org.id} scope="workspace" workspaceId={workspace.id} canManage={canManageOrg(myMembership)} /></TabsContent>
          <TabsContent value="release-notes" className="mt-0 flex-1 overflow-y-auto"><ReleaseNotesPanel orgId={org.id} currentUser={currentUser} workspaceId={workspace.id} canManage={canManageOrg(myMembership)} /></TabsContent>
      <TabsContent value="pinned" className="mt-0 flex-1 overflow-y-auto"><PinsAndAnnouncements orgId={org.id} currentUser={currentUser} workspaceId={workspace.id} canAnnounce={canManageOrg(myMembership)} /></TabsContent>
      <TabsContent value="links" className="mt-0 flex-1 overflow-y-auto p-6"><LinksManager orgId={org.id} currentUser={currentUser} workspaceId={workspace.id} /></TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(nextOpen) => { if (!savingWorkspace) setEditOpen(nextOpen) }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle>Edit workspace</DialogTitle>
            <DialogDescription>Update this project group. Changes to the default workflow apply only to projects created after you save.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-workspace-name">Workspace name <span className="text-destructive">*</span></Label>
              <Input id="edit-workspace-name" autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-workspace-description">Description</Label>
              <textarea
                id="edit-workspace-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
                placeholder="What kind of work belongs here?"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-workspace-team">Assigned team</Label>
                <Select value={editTeamId} onValueChange={setEditTeamId}>
                  <SelectTrigger id="edit-workspace-team"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">No assigned team</SelectItem>
                    {teams?.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The assigned team becomes available for project work and ticket assignment.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-workspace-workflow">Default workflow</Label>
                <Select value={editWorkflowPreset} onValueChange={setEditWorkflowPreset}>
                  <SelectTrigger id="edit-workspace-workflow"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(WORKFLOW_PRESETS).map(([value, preset]) => <SelectItem key={value} value={value}>{preset.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used as the starting point for new projects; current projects are unchanged.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingWorkspace}>Cancel</Button>
            <Button type="button" onClick={() => void saveWorkspace()} disabled={savingWorkspace || !editName.trim()}>{savingWorkspace ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          <DialogDescription>Added to the {workspace.name} project group. A project group simply keeps related projects together; delivery is planned inside each project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="proj-name">Name</Label>
              <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Input id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-workflow">Initial workflow</Label>
                <Select value={workflowPreset} onValueChange={setWorkflowPreset}>
                  <SelectTrigger id="project-workflow"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(WORKFLOW_PRESETS).map(([value, preset]) => <SelectItem key={value} value={value}>{preset.name}</SelectItem>)}{workflowSets?.length ? <><SelectItem value="reusable-templates" disabled>Reusable templates</SelectItem>{workflowSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</> : null}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{workflowSets?.find((set) => set.id === workflowPreset) ? 'This project will stay linked to the reusable template and receive future template updates.' : `${WORKFLOW_PRESETS[workflowPreset].description} This creates custom settings you can maintain from the project’s Settings tab.`}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Independent reviewer</Label>
                <Select value={reviewerId} onValueChange={setReviewerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Assign later</SelectItem>
                    {members?.filter(({ user }) => user.id !== currentUser.id).map(({ user }) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">You start as manager and work coordinator. The reviewer must be independent.</p>
              </div>
            </div>
            {workspace.workflowStages?.length ? <p className="text-xs text-muted-foreground">This workspace defaults to {WORKFLOW_PRESETS[workspaceWorkflowPreset]?.name ?? 'custom'} settings. Reusable templates remain linked; built-in presets create custom project settings.</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
