import {
  Activity,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  CircleGauge,
  ClockAlert,
  FolderKanban,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { calculateScheduleHealth, calculateTaskProgress } from '@/lib/schedule-health'
import type { Project, Task } from '@/types/domain'

type ProjectHealth = 'on_track' | 'at_risk' | 'delayed' | 'complete' | 'not_started' | 'archived'

interface ProjectSummary {
  project: Project
  completion: number
  health: ProjectHealth
}

const HEALTH_DETAILS: Record<
  ProjectHealth,
  {
    label: string
    variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
    icon: typeof CircleCheck
  }
> = {
  on_track: { label: 'On track', variant: 'success', icon: CircleCheck },
  at_risk: { label: 'At risk', variant: 'warning', icon: TriangleAlert },
  delayed: { label: 'Delayed', variant: 'destructive', icon: ClockAlert },
  complete: { label: 'Complete', variant: 'success', icon: CircleCheck },
  not_started: { label: 'Not started', variant: 'secondary', icon: CircleGauge },
  archived: { label: 'Archived', variant: 'outline', icon: FolderKanban },
}

function getProjectCompletion(project: Project, tasks: Task[]) {
  if (project.status === 'completed') return 100
  return calculateTaskProgress(tasks)
}

function getProjectHealth(project: Project, tasks: Task[], completion: number, now: Date): ProjectHealth {
  if (project.status === 'archived') return 'archived'
  if (project.status === 'completed' || completion === 100) return 'complete'
  if (tasks.length === 0) return 'not_started'

  const scheduleHealth = calculateScheduleHealth(project.startDate, project.endDate, completion, now)
  if (scheduleHealth?.status === 'delayed') return 'delayed'
  if (scheduleHealth?.status === 'at_risk') return 'at_risk'

  const hasDeliveryRisk = tasks.some((task) =>
    (task.status !== 'done' && Boolean(task.dueDate && new Date(task.dueDate).getTime() < now.getTime())) ||
    (task.status === 'in_review' && (!task.reviewerId || task.reviewerId === task.assigneeId)) ||
    (task.status === 'done' && task.reviewState !== 'approved'),
  )

  return hasDeliveryRisk ? 'at_risk' : 'on_track'
}

export function WorkspaceProjectOverview({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const now = new Date()
  const tasksByProject = new Map<string, Task[]>()
  for (const task of tasks) {
    const projectTasks = tasksByProject.get(task.projectId)
    if (projectTasks) projectTasks.push(task)
    else tasksByProject.set(task.projectId, [task])
  }

  const summaries: ProjectSummary[] = projects.map((project) => {
    const projectTasks = tasksByProject.get(project.id) ?? []
    const completion = getProjectCompletion(project, projectTasks)
    return { project, completion, health: getProjectHealth(project, projectTasks, completion, now) }
  })
  const currentProjects = summaries.filter(({ project }) => project.status !== 'archived')
  const overallCompletion = currentProjects.length
    ? Math.round(currentProjects.reduce((sum, project) => sum + project.completion, 0) / currentProjects.length)
    : 0
  const activeProjects = projects.filter((project) => project.status === 'active').length
  const completedProjects = projects.filter((project) => project.status === 'completed').length
  const delayedProjects = summaries.filter((project) => project.health === 'delayed').length
  const atRiskProjects = summaries.filter((project) => project.health === 'at_risk').length

  return (
    <section aria-labelledby="workspace-overview-heading" className="space-y-4">
      <div>
        <h2 id="workspace-overview-heading" className="text-lg font-semibold text-foreground">Workspace overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Portfolio health and progress across every project in this workspace.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total projects" value={projects.length} icon={FolderKanban} hint="Includes archived" />
        <StatCard label="Active projects" value={activeProjects} icon={Activity} hint="Currently in delivery" accent="primary" />
        <StatCard label="Completed projects" value={completedProjects} icon={CircleCheck} hint="Reported complete" accent="success" />
        <StatCard label="Delayed projects" value={delayedProjects} icon={ClockAlert} hint="10%+ behind plan" accent="destructive" />
        <StatCard label="At-risk projects" value={atRiskProjects} icon={TriangleAlert} hint="Needs attention" accent="warning" />
        <StatCard label="Overall completion" value={`${overallCompletion}%`} icon={ChartNoAxesCombined} hint="Average current progress" accent="accent" />
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Project summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {summaries.map(({ project, completion, health }) => {
              const healthDetails = HEALTH_DETAILS[health]
              const HealthIcon = healthDetails.icon
              return (
                <Link
                  key={project.id}
                  to={`../projects/${project.id}`}
                  className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-200 hover:bg-muted/60 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_auto_auto] sm:px-5"
                >
                  <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 sm:col-start-auto sm:row-start-auto">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                    <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
                  </span>
                  <span className="col-span-2 col-start-1 row-start-2 flex items-center gap-3 sm:col-span-1 sm:col-start-auto sm:row-start-auto">
                    <span
                      role="progressbar"
                      aria-label={`${project.name} completion`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={completion}
                      className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                      <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${completion}%` }} />
                    </span>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">{completion}%</span>
                  </span>
                  <Badge variant={healthDetails.variant} className="col-start-2 row-start-1 justify-self-end whitespace-nowrap sm:col-start-auto sm:row-start-auto">
                    <HealthIcon aria-hidden="true" className="size-3" />
                    {healthDetails.label}
                  </Badge>
                  <ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block" />
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
