import type { PlanTier } from '@/types/domain'

export type FeatureKey =
  | 'projectScheduling'
  | 'milestones'
  | 'calendar'
  | 'gantt'
  | 'projectTicketing'
  | 'publicTicketPortal'
  | 'ticketToTask'
  | 'ticketCategories'
  | 'ticketAttachments'
  | 'sla'
  | 'ticketAutomation'
  | 'customTicketForms'
  | 'api'

export type ReportLevel = 'none' | 'basic' | 'advanced'

/** null limit means unlimited */
export interface PlanLimits {
  teams: number | null
  members: number | null
  workspaces: number | null
  projects: number | null
  /** Storage capacity in GB. */
  storageGb: number
}

export interface PlanConfig {
  id: PlanTier
  name: string
  tagline: string
  monthlyPrice: number | null
  limits: PlanLimits
  features: Record<FeatureKey, boolean>
  reportLevel: ReportLevel
}

/**
 * Source of truth for the pricing/feature table. Seeded into the `planConfigs`
 * Dexie table on first run — Super Admin edits the DB copy at runtime, this
 * module is only the factory default used to (re)seed it.
 */
export const DEFAULT_PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Get a small team moving',
    monthlyPrice: 0,
    limits: { teams: 1, members: 5, workspaces: 1, projects: 2, storageGb: 1 },
    features: {
      projectScheduling: false,
      milestones: false,
      calendar: false,
      gantt: false,
      projectTicketing: false,
      publicTicketPortal: false,
      ticketToTask: false,
      ticketCategories: false,
      ticketAttachments: false,
      sla: false,
      ticketAutomation: false,
      customTicketForms: false,
      api: false,
    },
    reportLevel: 'none',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Scheduling, ticketing, and reporting for growing teams',
    monthlyPrice: 29,
    limits: { teams: 5, members: 25, workspaces: 5, projects: 20, storageGb: 25 },
    features: {
      projectScheduling: true,
      milestones: true,
      calendar: true,
      gantt: true,
      projectTicketing: true,
      publicTicketPortal: true,
      ticketToTask: true,
      ticketCategories: true,
      ticketAttachments: true,
      sla: false,
      ticketAutomation: false,
      customTicketForms: false,
      api: false,
    },
    reportLevel: 'basic',
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'SLAs, automation, and the API for unlimited scale',
    monthlyPrice: 99,
    limits: { teams: null, members: null, workspaces: null, projects: null, storageGb: 250 },
    features: {
      projectScheduling: true,
      milestones: true,
      calendar: true,
      gantt: true,
      projectTicketing: true,
      publicTicketPortal: true,
      ticketToTask: true,
      ticketCategories: true,
      ticketAttachments: true,
      sla: true,
      ticketAutomation: true,
      customTicketForms: true,
      api: true,
    },
    reportLevel: 'advanced',
  },
}

export const PLAN_ORDER: PlanTier[] = ['free', 'pro', 'business']

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  projectScheduling: 'Project Scheduling',
  milestones: 'Milestones',
  calendar: 'Calendar',
  gantt: 'Gantt / Timeline',
  projectTicketing: 'Project Ticketing',
  publicTicketPortal: 'Public Ticket Portal',
  ticketToTask: 'Ticket → Task',
  ticketCategories: 'Ticket Categories',
  ticketAttachments: 'Ticket Attachments',
  sla: 'SLA',
  ticketAutomation: 'Ticket Automation',
  customTicketForms: 'Custom Ticket Forms',
  api: 'API',
}

export const FEATURE_GROUPS: { label: string; features: FeatureKey[] }[] = [
  { label: 'Planning & delivery', features: ['projectScheduling', 'milestones', 'calendar', 'gantt'] },
  { label: 'Tickets & support', features: ['projectTicketing', 'publicTicketPortal', 'ticketToTask', 'ticketCategories', 'ticketAttachments'] },
  { label: 'Operations', features: ['sla', 'ticketAutomation', 'customTicketForms', 'api'] },
]

export function nextTier(plan: PlanTier): PlanTier | null {
  const i = PLAN_ORDER.indexOf(plan)
  return i >= 0 && i < PLAN_ORDER.length - 1 ? PLAN_ORDER[i + 1] : null
}
