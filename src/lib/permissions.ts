import type { OrgMember } from '@/types/domain'

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
