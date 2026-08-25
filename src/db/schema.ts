import Dexie, { type EntityTable } from 'dexie'
import type {
  User,
  Organization,
  Invoice,
  Payment,
  OrgMember,
  Team,
  Workspace,
  Project,
  SavedLink,
  PinnedItem,
  Announcement,
  ReleaseNote,
  Sprint,
  Task,
  Subtask,
  TaskComment,
  TaskAttachment,
  TaskCommentReadState,
  Milestone,
  Ticket,
  TicketCategory,
  TicketAttachment,
  TicketComment,
  TicketActivity,
  SLAPolicy,
  TicketAutomation,
  CustomTicketForm,
  ApiKey,
  AuditLog,
  ChatConversation,
  ChatMessage,
  ChatReadState,
  FileEntry,
  RecurringReport,
  CalendarEvent,
  WorkflowSet,
  AuthCredential,
  AuthSession,
  VerificationToken,
  OrganizationSubscription,
  OrganizationInvitation,
  BillingLifecycleEvent,
} from '@/types/domain'
import type { PlanConfig } from '@/lib/plans'
import { formatTaskCode, projectCodePrefix } from '@/lib/task-code'

export interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
}

export class ConnectioDB extends Dexie {
  users!: EntityTable<User, 'id'>
  authCredentials!: EntityTable<AuthCredential, 'userId'>
  authSessions!: EntityTable<AuthSession, 'id'>
  verificationTokens!: EntityTable<VerificationToken, 'id'>
  organizations!: EntityTable<Organization, 'id'>
  subscriptions!: EntityTable<OrganizationSubscription, 'id'>
  invitations!: EntityTable<OrganizationInvitation, 'id'>
  invoices!: EntityTable<Invoice, 'id'>
  payments!: EntityTable<Payment, 'id'>
  billingEvents!: EntityTable<BillingLifecycleEvent, 'id'>
  orgMembers!: EntityTable<OrgMember, 'id'>
  teams!: EntityTable<Team, 'id'>
  workspaces!: EntityTable<Workspace, 'id'>
  projects!: EntityTable<Project, 'id'>
  links!: EntityTable<SavedLink, 'id'>
  pins!: EntityTable<PinnedItem, 'id'>
  announcements!: EntityTable<Announcement, 'id'>
  releaseNotes!: EntityTable<ReleaseNote, 'id'>
  sprints!: EntityTable<Sprint, 'id'>
  tasks!: EntityTable<Task, 'id'>
  subtasks!: EntityTable<Subtask, 'id'>
  taskComments!: EntityTable<TaskComment, 'id'>
  taskAttachments!: EntityTable<TaskAttachment, 'id'>
  taskCommentReadStates!: EntityTable<TaskCommentReadState, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  tickets!: EntityTable<Ticket, 'id'>
  ticketCategories!: EntityTable<TicketCategory, 'id'>
  ticketAttachments!: EntityTable<TicketAttachment, 'id'>
  ticketComments!: EntityTable<TicketComment, 'id'>
  ticketActivities!: EntityTable<TicketActivity, 'id'>
  slaPolicies!: EntityTable<SLAPolicy, 'id'>
  ticketAutomations!: EntityTable<TicketAutomation, 'id'>
  customTicketForms!: EntityTable<CustomTicketForm, 'id'>
  apiKeys!: EntityTable<ApiKey, 'id'>
  auditLogs!: EntityTable<AuditLog, 'id'>
  chatConversations!: EntityTable<ChatConversation, 'id'>
  chatMessages!: EntityTable<ChatMessage, 'id'>
  chatReadStates!: EntityTable<ChatReadState, 'id'>
  files!: EntityTable<FileEntry, 'id'>
  recurringReports!: EntityTable<RecurringReport, 'id'>
  calendarEvents!: EntityTable<CalendarEvent, 'id'>
  workflowSets!: EntityTable<WorkflowSet, 'id'>
  planConfigs!: EntityTable<PlanConfig, 'id'>
  featureFlags!: EntityTable<FeatureFlag, 'id'>
  meta!: EntityTable<{ key: string; value: string }, 'key'>

  constructor() {
    super('connectio')

    this.version(1).stores({
      users: 'id, email, role',
      organizations: 'id, slug, plan, status',
      orgMembers: 'id, orgId, userId, [orgId+userId]',
      teams: 'id, orgId',
      workspaces: 'id, orgId, teamId',
      projects: 'id, orgId, workspaceId, status',
      sprints: 'id, projectId, status',
      tasks: 'id, projectId, sprintId, status, assigneeId',
      subtasks: 'id, taskId',
      milestones: 'id, projectId, status',
      tickets: 'id, orgId, projectId, status, categoryId, assigneeId, createdAt',
      ticketCategories: 'id, orgId',
      ticketAttachments: 'id, ticketId',
      ticketComments: 'id, ticketId, createdAt',
      slaPolicies: 'id, orgId, priority',
      ticketAutomations: 'id, orgId',
      customTicketForms: 'id, orgId',
      apiKeys: 'id, orgId',
      auditLogs: 'id, orgId, createdAt',
      planConfigs: 'id',
      featureFlags: 'id',
      meta: 'key',
    })

    // v2: tickets are now always project-scoped, with an approval gate before
    // becoming a task — index `approval` so pending-review lists stay fast.
    this.version(2).stores({
      tickets: 'id, orgId, projectId, status, approval, categoryId, assigneeId, createdAt',
    })

    this.version(3).stores({
      chatConversations: 'id, orgId, scope, teamId, workspaceId, projectId',
      chatMessages: 'id, conversationId, authorId, createdAt',
      chatReadStates: 'id, conversationId, userId, [conversationId+userId]',
    })

    this.version(4).stores({
      chatConversations: 'id, orgId, scope, teamId, workspaceId, projectId',
      chatMessages: 'id, conversationId, authorId, createdAt',
      chatReadStates: 'id, conversationId, userId, [conversationId+userId]',
    })

    this.version(5).stores({
      links: 'id, orgId, workspaceId, projectId, createdAt',
    })

    this.version(6).stores({
      files: 'id, orgId, workspaceId, projectId, parentId, kind, [orgId+parentId], [workspaceId+parentId], [projectId+parentId], updatedAt',
    })

    this.version(7).stores({
      files: 'id, orgId, workspaceId, projectId, parentId, kind, [orgId+parentId], [workspaceId+parentId], [projectId+parentId], updatedAt',
    }).upgrade((transaction) => transaction.table('planConfigs').toCollection().modify((plan) => {
      plan.limits.storageGb ??= plan.id === 'free' ? 1 : plan.id === 'pro' ? 25 : 250
    }))

    this.version(8).stores({
      pins: 'id, orgId, workspaceId, projectId, createdAt',
      announcements: 'id, orgId, workspaceId, projectId, publishAt, expiresAt, pinned, createdAt',
    })

    this.version(9).stores({
      recurringReports: 'id, orgId, scope, workspaceId, projectId, enabled, nextRunAt',
    })

    this.version(10).stores({
      releaseNotes: 'id, orgId, workspaceId, projectId, status, date, authorId, createdAt',
    })

    this.version(11).stores({
      tickets: 'id, orgId, projectId, status, approval, categoryId, assigneeId, escalatedAt, createdAt',
      ticketActivities: 'id, ticketId, type, createdAt',
    })

    this.version(12).stores({
      taskComments: 'id, taskId, authorId, createdAt',
      taskAttachments: 'id, taskId, createdAt',
      taskCommentReadStates: 'id, taskId, userId, [taskId+userId]',
    })

    this.version(13).stores({
      calendarEvents: 'id, orgId, workspaceId, projectId, date, type',
    })

    this.version(14).stores({
      workflowSets: 'id, orgId, name, createdAt',
    })

    this.version(15).stores({
      invoices: 'id, orgId, number, status, issuedAt, dueAt',
      payments: 'id, orgId, invoiceId, status, createdAt',
    }).upgrade(async (transaction) => {
      const invoices = transaction.table('invoices')
      if (await invoices.count()) return

      const organizations = await transaction.table('organizations').toArray() as Organization[]
      const plans = await transaction.table('planConfigs').toArray() as PlanConfig[]
      const priceByPlan = new Map(plans.map((plan) => [plan.id, plan.monthlyPrice]))
      const now = Date.now()
      const day = 86_400_000
      const invoiceRows: Invoice[] = []
      const paymentRows: Payment[] = []

      for (const org of organizations) {
        const amount = org.plan ? priceByPlan.get(org.plan) ?? 0 : 0
        if (amount <= 0) continue
        for (let month = 5; month >= 0; month--) {
          const invoiceId = `invoice-migration-${org.id}-${month}`
          const issuedAt = new Date(now - (month * 30 + 3) * day).toISOString()
          const failed = org.status === 'suspended' && month === 0
          invoiceRows.push({
            id: invoiceId,
            orgId: org.id,
            number: `INV-${new Date(issuedAt).getFullYear()}-${org.id.slice(-4).toUpperCase()}${month}`,
            periodStart: issuedAt,
            periodEnd: new Date(now - (month * 30 - 27) * day).toISOString(),
            issuedAt,
            dueAt: new Date(now - (month * 30 - 4) * day).toISOString(),
            amount,
            currency: 'USD',
            status: failed ? 'overdue' : 'paid',
          })
          paymentRows.push({
            id: `payment-migration-${org.id}-${month}`,
            orgId: org.id,
            invoiceId,
            amount,
            currency: 'USD',
            status: failed ? 'failed' : 'succeeded',
            methodBrand: 'Visa',
            methodLast4: '4242',
            createdAt: new Date(now - (month * 30 + 2) * day).toISOString(),
            paidAt: failed ? undefined : new Date(now - (month * 30 + 2) * day).toISOString(),
          })
        }
      }

      await invoices.bulkAdd(invoiceRows)
      await transaction.table('payments').bulkAdd(paymentRows)
    })

    this.version(16).stores({
      users: 'id, email, role, verificationStatus',
      authCredentials: 'userId',
      authSessions: 'id, userId, expiresAt',
      verificationTokens: 'id, userId, expiresAt, usedAt',
      organizations: 'id, slug, plan, status, onboardingStep',
      subscriptions: 'id, &orgId, planId, status',
      invitations: 'id, orgId, targetEmail, tokenHash, status, expiresAt',
    })

    this.version(17).stores({
      billingEvents: 'id, correlationId, orgId, userId, invoiceId, paymentId, event, status, createdAt',
    })

    // v18: UUIDs remain internal while every task receives a stable, readable
    // project-scoped code such as SCMS-001.
    this.version(18).stores({
      tasks: 'id, projectId, sprintId, status, assigneeId, code, [projectId+code]',
    }).upgrade(async (transaction) => {
      const projects = await transaction.table('projects').toArray() as Project[]
      const tasks = await transaction.table('tasks').toArray() as Task[]
      const tasksByProject = new Map<string, Task[]>()

      for (const task of tasks) {
        const projectTasks = tasksByProject.get(task.projectId) ?? []
        projectTasks.push(task)
        tasksByProject.set(task.projectId, projectTasks)
      }

      for (const project of projects) {
        const prefix = project.taskCodePrefix ?? projectCodePrefix(project.name)
        if (!project.taskCodePrefix) await transaction.table('projects').update(project.id, { taskCodePrefix: prefix })

        const projectTasks = (tasksByProject.get(project.id) ?? []).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.order - b.order || a.id.localeCompare(b.id),
        )
        for (let index = 0; index < projectTasks.length; index += 1) {
          const task = projectTasks[index]
          if (!task.code) await transaction.table('tasks').update(task.id, { code: formatTaskCode(prefix, index + 1) })
        }
      }
    })
  }
}

export const db = new ConnectioDB()
