import type { MilestoneStatus, Sprint, Task } from '@/types/domain'

export type ScheduleHealth = 'on_track' | 'at_risk' | 'delayed'

export const DEFAULT_DELAYED_THRESHOLD = 10

export interface ScheduleHealthResult {
  expectedProgress: number
  actualProgress: number
  delayPercentage: number
  status: ScheduleHealth
}

/**
 * Compares completed work against the portion of a planned timeline that has
 * elapsed. The threshold is intentionally an argument so it can later be
 * supplied from organization-level settings without changing the calculation.
 */
export function calculateScheduleHealth(
  startDate: string | undefined,
  endDate: string | undefined,
  actualProgress: number,
  now = new Date(),
  delayedThreshold = DEFAULT_DELAYED_THRESHOLD,
): ScheduleHealthResult | undefined {
  const start = startDate ? new Date(startDate).getTime() : Number.NaN
  const end = endDate ? new Date(endDate).getTime() : Number.NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined

  const totalDuration = end - start
  const elapsedDuration = Math.min(Math.max(now.getTime() - start, 0), totalDuration)
  const expectedProgress = Math.round((elapsedDuration / totalDuration) * 100)
  const normalizedActual = Math.round(Math.min(Math.max(actualProgress, 0), 100))
  const delayPercentage = Math.max(expectedProgress - normalizedActual, 0)

  return {
    expectedProgress,
    actualProgress: normalizedActual,
    delayPercentage,
    status: delayPercentage === 0 ? 'on_track' : delayPercentage < delayedThreshold ? 'at_risk' : 'delayed',
  }
}

/** Uses explicit task completion when available, otherwise treats the project's final stage as 100%. */
export function calculateTaskProgress(tasks: Task[], finalStatus = 'done') {
  if (tasks.length === 0) return 0
  const total = tasks.reduce((sum, task) => {
    const completion = task.completion ?? (task.status === finalStatus ? 100 : 0)
    return sum + Math.min(Math.max(completion, 0), 100)
  }, 0)
  return Math.round(total / tasks.length)
}

export interface MilestoneDelivery {
  sprintCount: number
  completedSprintCount: number
  taskCount: number
  completedTaskCount: number
  progress: number
  hasLinkedWork: boolean
  isComplete: boolean
}

/** Combines direct task links with tasks inherited through a linked sprint. */
export function calculateMilestoneDelivery(
  milestoneId: string,
  sprints: Sprint[],
  tasks: Task[],
  finalStatus = 'done',
): MilestoneDelivery {
  const linkedSprints = sprints.filter((sprint) => sprint.milestoneId === milestoneId)
  const sprintById = new Map(sprints.map((sprint) => [sprint.id, sprint]))
  const relatedTasks = tasks.filter((task) => {
    const inheritedMilestoneId = task.sprintId ? sprintById.get(task.sprintId)?.milestoneId : undefined
    return (inheritedMilestoneId ?? task.milestoneId) === milestoneId
  })
  const completedSprintCount = linkedSprints.filter((sprint) => sprint.status === 'completed').length
  const completedTaskCount = relatedTasks.filter((task) => task.status === finalStatus).length
  const linkedWorkCount = linkedSprints.length + relatedTasks.length
  const completedWorkCount = completedSprintCount + completedTaskCount

  return {
    sprintCount: linkedSprints.length,
    completedSprintCount,
    taskCount: relatedTasks.length,
    completedTaskCount,
    progress: linkedWorkCount ? Math.round((completedWorkCount / linkedWorkCount) * 100) : 0,
    hasLinkedWork: linkedWorkCount > 0,
    isComplete: linkedWorkCount > 0 && completedWorkCount === linkedWorkCount,
  }
}

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Milestones have no duration: they are complete when linked work is done, or delayed after their due date. */
export function calculateMilestoneStatus(
  dueDate: string,
  isComplete: boolean,
  now = new Date(),
): MilestoneStatus {
  if (isComplete) return 'completed'
  return localDateKey(now) > dueDate.slice(0, 10) ? 'delayed' : 'on_track'
}

export const SCHEDULE_HEALTH_LABEL: Record<ScheduleHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  delayed: 'Delayed',
}

export const SCHEDULE_HEALTH_VARIANT: Record<ScheduleHealth, 'success' | 'warning' | 'destructive'> = {
  on_track: 'success',
  at_risk: 'warning',
  delayed: 'destructive',
}
