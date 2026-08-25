import type { Ticket, TicketApproval, TicketPriority, TicketStatus } from '@/types/domain'

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const TICKET_STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  open: 'default',
  in_progress: 'warning',
  waiting: 'secondary',
  resolved: 'success',
  closed: 'outline',
}

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TICKET_PRIORITY_DOT: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-warning',
  urgent: 'bg-destructive',
}

export const TICKET_APPROVAL_LABEL: Record<TicketApproval, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const TICKET_APPROVAL_VARIANT: Record<TicketApproval, 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

export type TicketProcessStatus = TicketApproval | 'escalated'

export const TICKET_PROCESS_LABEL: Record<TicketProcessStatus, string> = {
  pending: 'Pending review',
  escalated: 'Escalated',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const TICKET_PROCESS_VARIANT: Record<TicketProcessStatus, 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  escalated: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

/** The visible ticket state is controlled by its review actions, not its legacy service-status field. */
export function ticketProcessStatus(ticket: Pick<Ticket, 'approval' | 'escalatedAt'>): TicketProcessStatus {
  return ticket.approval === 'pending' && ticket.escalatedAt ? 'escalated' : ticket.approval
}
