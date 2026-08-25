import type { OrgMember, Project } from '@/types/domain'

/** Only owners and admins can manage org-level membership, teams, and leads. */
export function canManageOrg(member: OrgMember | undefined | null): boolean {
  return member?.role === 'owner' || member?.role === 'admin'
}

/** Billing details contain sensitive financial data and are owner-only. */
export function canViewBilling(member: OrgMember | undefined | null): boolean {
  return member?.role === 'owner'
}

/** Owners/admins can always review tickets; plain members need the explicit reviewer flag. */
export function canReviewTickets(member: OrgMember | undefined | null): boolean {
  if (!member) return false
  return member.role === 'owner' || member.role === 'admin' || member.canReview === true
}

/** Project-level settings belong exclusively to the member assigned as project lead. */
export function canManageProject(project: Project | undefined | null, userId: string | undefined | null): boolean {
  return Boolean(project?.leadId && userId && project.leadId === userId)
}
