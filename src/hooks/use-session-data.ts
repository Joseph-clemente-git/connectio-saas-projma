import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { useSession } from '@/store/session'
import { DEFAULT_PLANS, type PlanConfig } from '@/lib/plans'
import type { PlanTier } from '@/types/domain'

export type SlugLookupStatus = 'loading' | 'found' | 'not-found'

/**
 * Resolves an org by slug once (not reactively) so a bad slug can reliably be
 * told apart from "still loading" — useLiveQuery alone returns `undefined`
 * for both cases. Once resolved, the org itself stays live via its id.
 */
export function useOrgBySlug(slug: string | undefined) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [status, setStatus] = useState<SlugLookupStatus>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setOrgId(null)
    if (!slug) {
      setStatus('not-found')
      return
    }
    db.organizations
      .where('slug')
      .equals(slug)
      .first()
      .then((found) => {
        if (cancelled) return
        if (found) {
          setOrgId(found.id)
          setStatus('found')
        } else {
          setStatus('not-found')
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const org = useLiveQuery(() => (orgId ? db.organizations.get(orgId) : undefined), [orgId])

  return { org, status }
}

export function useCurrentUser() {
  const userId = useSession((s) => s.userId)
  return useLiveQuery(() => (userId ? db.users.get(userId) : undefined), [userId])
}

export function useCurrentOrg() {
  const orgId = useSession((s) => s.orgId)
  return useLiveQuery(() => (orgId ? db.organizations.get(orgId) : undefined), [orgId])
}

export function usePlanConfig(planId: PlanTier | undefined): PlanConfig | undefined {
  const live = useLiveQuery(() => (planId ? db.planConfigs.get(planId) : undefined), [planId])
  if (live) return live
  if (planId) return DEFAULT_PLANS[planId]
  return undefined
}

export interface OrgUsage {
  teams: number
  members: number
  workspaces: number
  projects: number
}

export function useOrgUsage(orgId: string | undefined): OrgUsage | undefined {
  return useLiveQuery(async () => {
    if (!orgId) return undefined
    const [teams, members, workspaces, projects] = await Promise.all([
      db.teams.where('orgId').equals(orgId).count(),
      db.orgMembers.where('orgId').equals(orgId).count(),
      db.workspaces.where('orgId').equals(orgId).count(),
      db.projects.where('orgId').equals(orgId).count(),
    ])
    return { teams, members, workspaces, projects }
  }, [orgId])
}

export function useOrgMembersWithUsers(orgId: string | undefined) {
  return useLiveQuery(async () => {
    if (!orgId) return []
    const members = await db.orgMembers.where('orgId').equals(orgId).toArray()
    const users = await db.users.bulkGet(members.map((m) => m.userId))
    return members
      .map((member, i) => ({ member, user: users[i] }))
      .filter((entry): entry is { member: (typeof members)[number]; user: NonNullable<(typeof users)[number]> } =>
        Boolean(entry.user),
      )
  }, [orgId])
}

export function useOrgMemberRole(orgId: string | undefined, userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!orgId || !userId) return undefined
    return db.orgMembers.where('[orgId+userId]').equals([orgId, userId]).first()
  }, [orgId, userId])
}
