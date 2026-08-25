import type { Project, ProjectWorkflowLabels, TaskStatus, WorkflowStage, WorkspaceTerminology } from '@/types/domain'

export const WORKFLOW_ORDER: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']

export const WORKFLOW_PRESETS: Record<string, { name: string; description: string; labels: ProjectWorkflowLabels }> = {
  general: {
    name: 'General project',
    description: 'A neutral workflow for most organizations.',
    labels: { backlog: 'Ideas', todo: 'Ready', in_progress: 'In progress', in_review: 'Review / approval', done: 'Complete' },
  },
  software: {
    name: 'Software delivery',
    description: 'Tracks work from backlog through development and production.',
    labels: { backlog: 'Backlog', todo: 'Ready', in_progress: 'Development', in_review: 'Testing / review', done: 'Production' },
  },
  operations: {
    name: 'Operations',
    description: 'For service delivery and repeatable operational work.',
    labels: { backlog: 'Intake', todo: 'Scheduled', in_progress: 'Executing', in_review: 'Quality check', done: 'Delivered' },
  },
  marketing: {
    name: 'Campaign / content',
    description: 'For creative production and stakeholder approval.',
    labels: { backlog: 'Ideas', todo: 'Planned', in_progress: 'Creating', in_review: 'Approval', done: 'Published' },
  },
  construction: {
    name: 'Construction',
    description: 'Plans site delivery through procurement, inspection, and handover.',
    labels: { backlog: 'Planning', todo: 'Procurement', in_progress: 'Construction', in_review: 'Inspection', done: 'Handover' },
  },
  factory: {
    name: 'Factory',
    description: 'Follows production work through quality, packaging, and delivery.',
    labels: { backlog: 'Planning', todo: 'Production ready', in_progress: 'Production', in_review: 'Quality check', done: 'Packaging & delivery' },
  },
  events: {
    name: 'Events',
    description: 'Coordinates preparation, setup, the event, and breakdown.',
    labels: { backlog: 'Planning', todo: 'Preparation', in_progress: 'Setup', in_review: 'Event', done: 'Breakdown' },
  },
}

export const DEFAULT_WORKFLOW_LABELS = WORKFLOW_PRESETS.general.labels

export const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  { id: 'backlog', name: 'Ideas', description: 'Capture and shape incoming work.' },
  { id: 'todo', name: 'Ready', description: 'Prioritized and ready to start.' },
  { id: 'in_progress', name: 'In progress', description: 'Work is actively underway.' },
  { id: 'in_review', name: 'Review / approval', description: 'Independent review and decision.', requiresReview: true },
  { id: 'done', name: 'Complete', description: 'Approved and complete.' },
]

export const DEFAULT_TERMINOLOGY: WorkspaceTerminology = {
  workItem: 'Task', workItemPlural: 'Tasks', timebox: 'Cycle', timeboxPlural: 'Cycles',
  milestone: 'Milestone', milestonePlural: 'Milestones', issue: 'Issue', release: 'Release update',
}

export const TERMINOLOGY_PRESETS: Record<string, WorkspaceTerminology> = {
  general: DEFAULT_TERMINOLOGY,
  software: { workItem: 'Work item', workItemPlural: 'Work items', timebox: 'Sprint', timeboxPlural: 'Sprints', milestone: 'Milestone', milestonePlural: 'Milestones', issue: 'Issue', release: 'Release' },
  construction: { workItem: 'Work package', workItemPlural: 'Work packages', timebox: 'Phase', timeboxPlural: 'Phases', milestone: 'Handover point', milestonePlural: 'Handover points', issue: 'Site issue', release: 'Handover update' },
  factory: { workItem: 'Production order', workItemPlural: 'Production orders', timebox: 'Production run', timeboxPlural: 'Production runs', milestone: 'Production target', milestonePlural: 'Production targets', issue: 'Quality issue', release: 'Delivery update' },
  marketing: { workItem: 'Content item', workItemPlural: 'Content items', timebox: 'Campaign', timeboxPlural: 'Campaigns', milestone: 'Campaign milestone', milestonePlural: 'Campaign milestones', issue: 'Blocker', release: 'Campaign update' },
  events: { workItem: 'Run-of-show item', workItemPlural: 'Run-of-show items', timebox: 'Event phase', timeboxPlural: 'Event phases', milestone: 'Event milestone', milestonePlural: 'Event milestones', issue: 'Event issue', release: 'Event update' },
  operations: { workItem: 'Work order', workItemPlural: 'Work orders', timebox: 'Service cycle', timeboxPlural: 'Service cycles', milestone: 'Service milestone', milestonePlural: 'Service milestones', issue: 'Exception', release: 'Delivery update' },
}

export function stagesForPreset(preset: string): WorkflowStage[] {
  const labels = WORKFLOW_PRESETS[preset]?.labels ?? DEFAULT_WORKFLOW_LABELS
  return DEFAULT_WORKFLOW_STAGES.map((stage) => ({ ...stage, name: labels[stage.id as keyof ProjectWorkflowLabels] }))
}

export function terminologyForPreset(preset: string): WorkspaceTerminology {
  return TERMINOLOGY_PRESETS[preset] ?? DEFAULT_TERMINOLOGY
}

export function workflowStages(project: Pick<Project, 'workflowStages' | 'workflowLabels'>): WorkflowStage[] {
  if (project.workflowStages?.length) return project.workflowStages
  const labels = workflowLabels(project.workflowLabels)
  return DEFAULT_WORKFLOW_STAGES.map((stage) => ({ ...stage, name: labels[stage.id as keyof ProjectWorkflowLabels] }))
}

export function stageFor(project: Pick<Project, 'workflowStages' | 'workflowLabels'>, status: TaskStatus) {
  return workflowStages(project).find((stage) => stage.id === status)
}

export function isFinalStage(project: Pick<Project, 'workflowStages' | 'workflowLabels'>, status: TaskStatus) {
  const stages = workflowStages(project)
  return stages.at(-1)?.id === status
}

export function workflowLabels(labels?: ProjectWorkflowLabels): ProjectWorkflowLabels {
  return labels ?? DEFAULT_WORKFLOW_LABELS
}

export function statusForWorkflowMove(status: TaskStatus): TaskStatus {
  return status
}
