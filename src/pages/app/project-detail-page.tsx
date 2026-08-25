import { useOutletContext, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Layers, ListChecks, Lock, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KanbanBoard } from '@/components/project/kanban-board'
import { SprintsPanel } from '@/components/project/sprints-panel'
import { MilestonesPanel } from '@/components/project/milestones-panel'
import { GanttPanel } from '@/components/project/gantt-panel'
import { SupportPanel } from '@/components/project/support-panel'
import { TaskImportExportPanel } from '@/components/project/task-import-export-panel'
import { LinksManager } from '@/components/shared/links-manager'
import { FeatureGate } from '@/components/shared/feature-lock'
import { FileExplorer } from '@/components/files/file-explorer'
import { AnnouncementsAlert, PinsAndAnnouncements } from '@/components/shared/pins-and-announcements'
import { hasFeature } from '@/lib/entitlements'
import { canManageOrg } from '@/lib/permissions'
import { useOrgMemberRole } from '@/hooks/use-session-data'
import type { ProjectStatus } from '@/types/domain'
import { RecurringReportsPanel } from '@/components/shared/recurring-reports-panel'
import { ReleaseNotesPanel } from '@/components/project/release-notes-panel'
import { calculateScheduleHealth, calculateTaskProgress, SCHEDULE_HEALTH_LABEL, SCHEDULE_HEALTH_VARIANT } from '@/lib/schedule-health'
import { DEFAULT_TERMINOLOGY } from '@/lib/project-workflow'

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

export function ProjectDetailPage() {
  const { org, user: currentUser, plan } = useOutletContext<TenantOutletContext>()
  const { projectId } = useParams()
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const workspace = useLiveQuery(
    () => (project ? db.workspaces.get(project.workspaceId) : undefined),
    [project?.workspaceId],
  )
  const taskStats = useLiveQuery(async () => {
    if (!projectId) return undefined
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done' && t.reviewState === 'approved').length,
      actualProgress: calculateTaskProgress(tasks),
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      inReview: tasks.filter((t) => t.status === 'in_review').length,
      unassigned: tasks.filter((t) => t.status !== 'done' && !t.assigneeId).length,
      reviewRisks: tasks.filter((t) =>
        (t.status === 'in_review' && (!t.reviewerId || t.reviewerId === t.assigneeId)) ||
        (t.status === 'done' && t.reviewState !== 'approved'),
      ).length,
      overdue: tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    }
  }, [projectId])
  const sprintCount = useLiveQuery(
    () => (projectId ? db.sprints.where('projectId').equals(projectId).count() : 0),
    [projectId],
  )
  const myMembership = useOrgMemberRole(org.id, currentUser.id)
  const canManage = canManageOrg(myMembership)

  if (project === undefined) return <LoadingScreen />
  if (!project) {
    return (
      <div className="p-6">
        <EmptyState icon={Layers} title="Project not found" description="It may have been deleted." />
      </div>
    )
  }
  const canManageProject = canManage || project.leadId === currentUser.id
  const terminology = project.terminology ?? DEFAULT_TERMINOLOGY

  const scheduleHealth = calculateScheduleHealth(project.startDate, project.endDate, taskStats?.actualProgress ?? 0)
  const liveHealth = (() => {
    if (!taskStats?.total) return { label: 'Not started', variant: 'secondary' as const }
    if (taskStats.done === taskStats.total) return { label: 'Complete', variant: 'success' as const }
    if (scheduleHealth) return {
      label: scheduleHealth.delayPercentage > 0 ? `${scheduleHealth.delayPercentage}% behind schedule` : SCHEDULE_HEALTH_LABEL[scheduleHealth.status],
      variant: SCHEDULE_HEALTH_VARIANT[scheduleHealth.status],
    }
    if (taskStats.reviewRisks > 0) return { label: 'Review risk', variant: 'warning' as const }
    if (taskStats.overdue > 0 || taskStats.unassigned > 0) return { label: 'Needs attention', variant: 'warning' as const }
    return { label: 'On track', variant: 'success' as const }
  })()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={
          <Breadcrumbs items={[
            { label: 'Project groups', to: '../workspaces' },
            ...(workspace ? [{ label: workspace.name, to: `../workspaces/${workspace.id}` }] : []),
            { label: <span className="flex items-center gap-2 text-xl font-bold tracking-tight"><span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />{project.name}</span> },
          ]} />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[project.status]}>Reported: {STATUS_LABEL[project.status]}</Badge>
            <Badge variant={liveHealth.variant}>Live: {liveHealth.label}</Badge>
          </div>
        }
      />
      <AnnouncementsAlert projectId={project.id} />

      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <div className="scrollbar-thin overflow-x-auto border-b border-border bg-card px-6 py-3">
          <div className="flex w-max min-w-full items-center justify-between gap-6">
            <TabsList aria-label="Project work views" className="w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="task-data">{terminology.workItemPlural} data</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="sprints">{terminology.timeboxPlural}</TabsTrigger>
              <TabsTrigger value="milestones">
                {!hasFeature(plan, 'milestones') && <Lock className="size-3" />} {terminology.milestonePlural}
              </TabsTrigger>
              <TabsTrigger value="gantt">
                {!hasFeature(plan, 'gantt') && <Lock className="size-3" />} Gantt
              </TabsTrigger>
            </TabsList>
            <TabsList aria-label="Project resources" className="w-max">
              <TabsTrigger value="release-notes">{terminology.release}</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="pinned">Pinned</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="support">
                {!hasFeature(plan, 'projectTicketing') && <Lock className="size-3" />} Support
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="border-b border-border bg-muted/20 px-6 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">How work connects:</span> A project group organizes related projects. Within this project, {terminology.milestonePlural.toLowerCase()} define outcomes, {terminology.timeboxPlural.toLowerCase()} organize delivery, and the board shows committed {terminology.workItemPlural.toLowerCase()}.
        </div>

        <TabsContent value="overview" className="flex-1 p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>About this project</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{project.description ?? 'No description yet.'}</p>

                {hasFeature(plan, 'projectScheduling') ? (
                  <div className="grid max-w-sm grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="proj-start" className="text-xs text-muted-foreground">
                        Start date
                      </Label>
                      <Input
                        id="proj-start"
                        type="date"
                        value={project.startDate ? project.startDate.slice(0, 10) : ''}
                        onChange={(e) =>
                          db.projects.update(project.id, {
                            startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="proj-end" className="text-xs text-muted-foreground">
                        End date
                      </Label>
                      <Input
                        id="proj-end"
                        type="date"
                        value={project.endDate ? project.endDate.slice(0, 10) : ''}
                        onChange={(e) =>
                          db.projects.update(project.id, {
                            endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  project.startDate &&
                  project.endDate && (
                    <p className="text-sm text-foreground">
                      <span className="text-muted-foreground">Scheduled: </span>
                      {format(new Date(project.startDate), 'MMM d, yyyy')} – {format(new Date(project.endDate), 'MMM d, yyyy')}
                    </p>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ListChecks className="size-4" /> {terminology.workItemPlural}
                  </span>
                  <span className="font-medium text-foreground">
                    {taskStats?.done ?? 0}/{taskStats?.total ?? 0} done
                  </span>
                </div>
                {scheduleHealth && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Schedule health</span>
                      <Badge variant={SCHEDULE_HEALTH_VARIANT[scheduleHealth.status]}>
                        {scheduleHealth.delayPercentage > 0 ? `${scheduleHealth.delayPercentage}% behind schedule` : SCHEDULE_HEALTH_LABEL[scheduleHealth.status]}
                      </Badge>
                    </div>
                    <p className="mt-1.5">{scheduleHealth.actualProgress}% complete against {scheduleHealth.expectedProgress}% expected by today.</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                  <div><p className="text-lg font-semibold text-foreground">{taskStats?.inReview ?? 0}</p><p className="text-xs text-muted-foreground">In review</p></div>
                  <div><p className="text-lg font-semibold text-foreground">{taskStats?.unassigned ?? 0}</p><p className="text-xs text-muted-foreground">Unassigned</p></div>
                  <div><p className="text-lg font-semibold text-foreground">{taskStats?.overdue ?? 0}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
                </div>
                {(taskStats?.reviewRisks ?? 0) > 0 && (
                  <div className="flex gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" /> {taskStats?.reviewRisks} task(s) need an independent reviewer.</div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Repeat className="size-4" /> {terminology.timeboxPlural}
                  </span>
                  <span className="font-medium text-foreground">{sprintCount ?? 0}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${taskStats && taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="board" className="flex flex-1 flex-col">
          <KanbanBoard project={project} orgId={org.id} currentUserId={currentUser.id} canManage={canManageProject} />
        </TabsContent>

        <TabsContent value="task-data" className="mt-0 flex-1 overflow-y-auto">
          <TaskImportExportPanel project={project} orgId={org.id} currentUserId={currentUser.id} canManage={canManageProject} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0 flex-1 overflow-y-auto">
          <RecurringReportsPanel orgId={org.id} scope="project" workspaceId={project.workspaceId} projectId={project.id} canManage={canManageProject} />
        </TabsContent>

        <TabsContent value="release-notes" className="mt-0 flex-1 overflow-y-auto">
          <ReleaseNotesPanel orgId={org.id} currentUser={currentUser} workspaceId={project.workspaceId} projectId={project.id} canManage={canManageProject} />
        </TabsContent>

        <TabsContent value="sprints" className="flex-1">
          <SprintsPanel projectId={project.id} terminology={terminology} canManage={canManageProject} />
        </TabsContent>

        <TabsContent value="links" className="flex-1 overflow-y-auto p-6">
          <LinksManager orgId={org.id} currentUser={currentUser} projectId={project.id} />
        </TabsContent>

        <TabsContent value="files" className="mt-0 flex min-h-0 flex-1">
          <FileExplorer orgId={org.id} userId={currentUser.id} plan={plan} workspaceId={project.workspaceId} projectId={project.id} title={`${project.name} files`} />
        </TabsContent>

        <TabsContent value="pinned" className="mt-0 flex-1 overflow-y-auto">
          <PinsAndAnnouncements orgId={org.id} currentUser={currentUser} projectId={project.id} canAnnounce={canManageProject} />
        </TabsContent>

        <TabsContent value="milestones" className="flex flex-1 flex-col">
          <FeatureGate plan={plan} feature="milestones" label={terminology.milestonePlural}>
            <MilestonesPanel projectId={project.id} canManage={canManageProject} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="gantt" className="flex flex-1 flex-col">
          <FeatureGate plan={plan} feature="gantt" label="Gantt / Timeline">
            <GanttPanel projectId={project.id} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="support" className="flex flex-1 flex-col">
          <FeatureGate plan={plan} feature="projectTicketing" label="Project Ticketing">
            <SupportPanel orgId={org.id} orgSlug={org.slug} projectId={project.id} plan={plan} />
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  )
}
