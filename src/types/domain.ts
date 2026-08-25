export type ID = string

export type PlanTier = 'free' | 'pro' | 'business'

export type UserRole = 'super_admin' | 'org_owner' | 'admin' | 'member'

export interface User {
  id: ID
  name: string
  email: string
  avatarColor: string
  role: UserRole
  verificationStatus: 'pending' | 'verified'
  verifiedAt?: string
  title?: string
  createdAt: string
}

export interface Organization {
  id: ID
  name: string
  slug: string
  /** Assigned only after the owner selects a platform Plan during onboarding. */
  plan?: PlanTier
  status: 'active' | 'suspended'
  ownerId: ID
  logoColor: string
  industry?: string
  onboardingStep: 'plan' | 'workspace' | 'invite' | 'complete'
  onboardingCompletedAt?: string
  createdAt: string
}

/** Credentials are kept separate so normal user reads never expose password hashes. */
export interface AuthCredential {
  userId: ID
  passwordHash: string
  passwordSalt: string
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  failedAttempts: number
  lockedUntil?: string
  passwordChangedAt: string
  /** Set for administrator-provisioned accounts until the member replaces the temporary password. */
  mustChangePassword?: boolean
}

export interface AuthSession {
  id: ID
  userId: ID
  tokenHash: string
  expiresAt: string
  createdAt: string
  lastSeenAt: string
}

export interface VerificationToken {
  id: ID
  userId: ID
  tokenHash: string
  expiresAt: string
  attempts: number
  usedAt?: string
  createdAt: string
}

export interface OrganizationSubscription {
  id: ID
  orgId: ID
  planId: PlanTier
  status: 'active' | 'cancelled'
  startedAt: string
  updatedAt: string
}

export interface OrganizationInvitation {
  id: ID
  orgId: ID
  inviterId: ID
  targetEmail: string
  role: 'admin' | 'member'
  workspaceIds: ID[]
  canReview?: boolean
  tokenHash: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  /** New account prepared for this invitation; it becomes a member only after acceptance. */
  provisionedUserId?: ID
  acceptedByUserId?: ID
  acceptedAt?: string
  createdAt: string
}

export type InvoiceStatus = 'paid' | 'open' | 'overdue' | 'void'

/** A subscription invoice issued to one organization. */
export interface Invoice {
  id: ID
  orgId: ID
  number: string
  periodStart: string
  periodEnd: string
  issuedAt: string
  dueAt: string
  amount: number
  currency: 'USD'
  status: InvoiceStatus
}

export type PaymentStatus = 'succeeded' | 'pending' | 'failed'

/** A payment attempt against an organization invoice. */
export interface Payment {
  id: ID
  orgId: ID
  invoiceId: ID
  amount: number
  currency: 'USD'
  status: PaymentStatus
  methodBrand: 'Visa' | 'Mastercard' | 'Amex'
  methodLast4: string
  createdAt: string
  paidAt?: string
}

export type BillingEventStatus = 'info' | 'pending' | 'succeeded' | 'failed'

/** Durable, non-sensitive trace of registration and billing lifecycle events. */
export interface BillingLifecycleEvent {
  id: ID
  correlationId: ID
  orgId?: ID
  userId?: ID
  invoiceId?: ID
  paymentId?: ID
  event:
    | 'registration.started'
    | 'registration.completed'
    | 'registration.failed'
    | 'registration.email_verified'
    | 'organization.created'
    | 'subscription.selected'
    | 'subscription.activated'
    | 'invoice.created'
    | 'payment.required'
    | 'payment.not_required'
    | 'payment.attempt_started'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'onboarding.completed'
  status: BillingEventStatus
  message: string
  createdAt: string
}

export interface OrgMember {
  id: ID
  orgId: ID
  userId: ID
  role: 'owner' | 'admin' | 'member'
  teamIds: ID[]
  /** Empty/omitted means organization-wide access; invitations may scope this list. */
  workspaceIds?: ID[]
  /** Explicit reviewer grant for plain members. Owners/admins can always
   *  review regardless of this flag — see canReviewTickets(). */
  canReview?: boolean
  joinedAt: string
}

export interface Team {
  id: ID
  orgId: ID
  name: string
  memberIds: ID[]
  /** The member who leads this team; should be one of memberIds. */
  leadId?: ID
  createdAt: string
}

export interface Workspace {
  id: ID
  orgId: ID
  teamId?: ID
  name: string
  description?: string
  /** Default delivery language and flow for projects created in this workspace. */
  workflowPreset?: string
  workflowStages?: WorkflowStage[]
  terminology?: WorkspaceTerminology
  createdAt: string
}

/** Human-facing names only; the engine keeps its generic records and relations. */
export interface WorkspaceTerminology {
  workItem: string
  workItemPlural: string
  timebox: string
  timeboxPlural: string
  milestone: string
  milestonePlural: string
  issue: string
  release: string
}

export type RecurringReportType = 'project_status' | 'task_progress' | 'workload' | 'summary'
export type ReportFrequency = 'weekly' | 'monthly' | 'custom'

/** A scheduled report. Delivery is performed by the scheduler integration. */
export interface RecurringReport {
  id: ID
  orgId: ID
  scope: 'workspace' | 'project'
  workspaceId?: ID
  projectId?: ID
  reportType: RecurringReportType
  recipientEmails: string[]
  frequency: ReportFrequency
  dayOfWeek?: number
  dayOfMonth?: number
  intervalDays?: number
  time: string
  enabled: boolean
  createdAt: string
  lastRunAt?: string
  nextRunAt: string
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'

export interface ProjectWorkflowLabels {
  backlog: string
  todo: string
  in_progress: string
  in_review: string
  done: string
}

/** A project owns its delivery flow. Stage ids are stable so tasks remain
 * traceable when a stage is renamed or reordered. */
export interface WorkflowStage {
  id: string
  name: string
  description?: string
  /** A free-form policy note, e.g. "Design sign-off before build". */
  rules?: string
  /** One or more people explicitly responsible for this stage. */
  reviewerIds?: ID[]
  /** All members of these teams may review this stage. */
  reviewerTeamIds?: ID[]
  /** A reviewer decision is required before the task may move forward. */
  requiresReview?: boolean
}

/** Reusable project template. Linked projects stay synchronized until customized. */
export interface WorkflowSet {
  id: ID
  orgId: ID
  name: string
  description?: string
  workflowStages: WorkflowStage[]
  terminology?: WorkspaceTerminology
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: ID
  orgId: ID
  workspaceId: ID
  name: string
  description?: string
  /** The org member accountable for this project ("project lead"). */
  leadId?: ID
  /** The member who defines and coordinates task intake for this project. */
  coordinatorId?: ID
  /** Default independent checker for work submitted for review. */
  reviewerId?: ID
  /** Project-specific names for the five auditable workflow stages. */
  workflowLabels?: ProjectWorkflowLabels
  /** Ordered, unlimited project-specific workflow stages. */
  workflowStages?: WorkflowStage[]
  /** Shared template source. Direct workflow or terminology edits clear this link. */
  workflowSetId?: ID
  /** Optional project override for the workspace's terminology. */
  terminology?: WorkspaceTerminology
  status: ProjectStatus
  startDate?: string
  endDate?: string
  color: string
  createdAt: string
}

/** A saved resource, scoped to either a workspace or a single project. */
export interface SavedLink {
  id: ID
  orgId: ID
  workspaceId?: ID
  projectId?: ID
  title: string
  url: string
  description: string
  category: string
  addedById: ID
  createdAt: string
}

export type PinKind = 'link' | 'file' | 'task' | 'message' | 'note' | 'announcement'

/** A shortcut to an important resource, limited to one workspace or project. */
export interface PinnedItem {
  id: ID
  orgId: ID
  workspaceId?: ID
  projectId?: ID
  kind: PinKind
  title: string
  description?: string
  url?: string
  createdById: ID
  createdAt: string
}

export type AnnouncementAudience = 'all_members' | 'managers' | 'project_members'

/** A time-bounded update, published within a workspace or project. */
export interface Announcement {
  id: ID
  orgId: ID
  workspaceId?: ID
  projectId?: ID
  title: string
  content: string
  attachments: string[]
  links: string[]
  publishAt: string
  expiresAt?: string
  audience: AnnouncementAudience
  pinned: boolean
  createdById: ID
  createdAt: string
}

export type ReleaseNoteStatus = 'draft' | 'published'

/**
 * A durable update recording a completed phase, launch, handoff, or other
 * meaningful delivery moment. Despite the historic name, this is deliberately
 * not limited to software version releases.
 */
export interface ReleaseNote {
  id: ID
  orgId: ID
  workspaceId: ID
  projectId?: ID
  title: string
  description: string
  date: string
  relatedTaskIds: ID[]
  relatedMilestoneIds: ID[]
  fileIds: ID[]
  imageIds: ID[]
  links: string[]
  authorId: ID
  status: ReleaseNoteStatus
  createdAt: string
  updatedAt: string
}

export type FileEntryKind = 'file' | 'folder'
export type FilePermission = 'workspace' | 'project' | 'private'

/** A locally persisted file-system entry. Folders and files share a tree via parentId. */
export interface FileEntry {
  id: ID
  orgId: ID
  workspaceId?: ID
  projectId?: ID
  parentId?: ID
  kind: FileEntryKind
  name: string
  mimeType?: string
  size: number
  blob?: Blob
  permission: FilePermission
  version: number
  createdAt: string
  updatedAt: string
  updatedById: ID
}

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: ID
  projectId: ID
  name: string
  goal?: string
  /** The outcome checkpoint this sprint contributes to. */
  milestoneId?: ID
  startDate: string
  endDate: string
  status: SprintStatus
}

/** References a WorkflowStage.id. Legacy status values remain valid. */
export type TaskStatus = string
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskReviewState = 'pending' | 'approved' | 'changes_requested'

export interface Task {
  id: ID
  projectId: ID
  sprintId?: ID
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  /** The member who added/defined the work. */
  createdById?: ID
  assigneeId?: ID
  reviewState?: TaskReviewState
  reviewedAt?: string
  /** Optional planning dates and metadata, including values imported from task spreadsheets. */
  startDate?: string
  dueDate?: string
  milestoneId?: ID
  completion?: number
  labels?: string[]
  /** A task-level signal that work cannot proceed without outside input. */
  isBlocked?: boolean
  /** Explains what is preventing progress, visible on task cards. */
  blockerReason?: string
  order: number
  createdAt: string
}

/** A conversation entry attached to a single task. */
export interface TaskComment {
  id: ID
  taskId: ID
  authorId: ID
  authorName: string
  body: string
  createdAt: string
}

/** A file or screenshot attached directly to a task conversation. */
export interface TaskAttachment {
  id: ID
  taskId: ID
  fileName: string
  size: number
  mimeType: string
  blob?: Blob
  createdAt: string
}

/** Per-user read cursor for task discussion, used for card-level unread counts. */
export interface TaskCommentReadState {
  id: ID
  taskId: ID
  userId: ID
  readAt: string
}

export interface Subtask {
  id: ID
  taskId: ID
  title: string
  done: boolean
  createdAt: string
}

/** Milestones are evaluated from their timeline and related delivery work. */
export type MilestoneStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed'

export interface Milestone {
  id: ID
  projectId: ID
  name: string
  /** @deprecated Legacy value retained while existing IndexedDB records age out. */
  startDate?: string
  dueDate: string
  status: MilestoneStatus
  /** Automatically recorded when all linked work is completed. */
  completedAt?: string
}

export type CalendarEventType = 'project_kickoff' | 'client_meeting' | 'team_meeting' | 'site_inspection' | 'production_schedule' | 'review' | 'approval' | 'deadline' | 'project_event'

/** A manually scheduled event that can be shared across a workspace or project. */
export interface CalendarEvent {
  id: ID
  orgId: ID
  title: string
  type: CalendarEventType
  date: string
  startTime?: string
  endTime?: string
  attendeeIds: ID[]
  description?: string
  location?: string
  workspaceId?: ID
  projectId?: ID
  createdById: ID
  createdAt: string
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Every ticket is a request from the org's own client, scoped to one of the
 * org's projects — not a request directed at Connectio itself. `approval`
 * gates whether it becomes a Task: a member reviews a pending ticket and
 * either approves it (creating a task, assigned to a member) or rejects it.
 */
export type TicketApproval = 'pending' | 'approved' | 'rejected'

export interface Ticket {
  id: ID
  orgId: ID
  projectId: ID
  categoryId?: ID
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  submitterName: string
  submitterEmail: string
  assigneeId?: ID
  slaId?: ID
  source: 'portal' | 'internal'
  approval: TicketApproval
  approvalNote?: string
  convertedTaskId?: ID
  /** If set, this is a client resubmission of a prior ticket. */
  resubmissionOfTicketId?: ID
  /** Internal project-team escalation routed to an organization decision-maker. */
  escalatedAt?: string
  escalationReason?: string
  escalatedByUserId?: ID
  escalatedToUserId?: ID
  escalationApprovedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TicketCategory {
  id: ID
  orgId: ID
  name: string
  color: string
}

export interface TicketAttachment {
  id: ID
  ticketId: ID
  fileName: string
  size: number
  mimeType: string
}

export interface TicketComment {
  id: ID
  ticketId: ID
  authorName: string
  authorId?: ID
  body: string
  internal: boolean
  createdAt: string
}

export type TicketActivityType = 'escalated' | 'approved' | 'escalation_approved'

/** Durable ticket timeline events that should remain separate from conversation replies. */
export interface TicketActivity {
  id: ID
  ticketId: ID
  type: TicketActivityType
  actorName: string
  description: string
  createdAt: string
}

export interface SLAPolicy {
  id: ID
  orgId: ID
  name: string
  priority: TicketPriority
  firstResponseMins: number
  resolutionMins: number
}

export interface TicketAutomation {
  id: ID
  orgId: ID
  name: string
  triggerField: 'status' | 'priority' | 'category'
  triggerValue: string
  action: 'assign' | 'set_priority' | 'add_category' | 'notify'
  actionValue: string
  enabled: boolean
}

export interface CustomTicketFormField {
  id: ID
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

export interface CustomTicketForm {
  id: ID
  orgId: ID
  name: string
  fields: CustomTicketFormField[]
}

export interface ApiKey {
  id: ID
  orgId: ID
  name: string
  key: string
  createdAt: string
  lastUsedAt?: string
  revoked: boolean
}

export interface AuditLog {
  id: ID
  orgId: ID
  actorName: string
  action: string
  target: string
  createdAt: string
}

export type ChatScope = 'workspace' | 'team' | 'project' | 'direct' | 'group' | 'client'

export interface ChatConversation {
  id: ID
  orgId: ID
  name: string
  scope: ChatScope
  participantIds: ID[]
  teamId?: ID
  workspaceId?: ID
  projectId?: ID
  /** Client channels are deliberately separate from internal organization chat. */
  clientName?: string
  clientEmail?: string
  createdAt: string
}

export interface ChatAttachment {
  id: ID
  fileName: string
  size: number
  mimeType: string
}

export interface ChatMessage {
  id: ID
  conversationId: ID
  authorId: ID
  authorName?: string
  authorType?: 'organization' | 'client'
  body: string
  attachments?: ChatAttachment[]
  createdAt: string
}

export interface ChatReadState {
  id: ID
  conversationId: ID
  userId: ID
  readAt: string
}
