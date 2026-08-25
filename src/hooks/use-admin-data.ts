import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { PlanTier } from '@/types/domain'

export function useAllOrganizations() {
  return useLiveQuery(() => db.organizations.toArray(), [])
}

export function useOrgUsageMap() {
  return useLiveQuery(async () => {
    const [teams, members, workspaces, projects] = await Promise.all([
      db.teams.toArray(),
      db.orgMembers.toArray(),
      db.workspaces.toArray(),
      db.projects.toArray(),
    ])
    const map: Record<string, { teams: number; members: number; workspaces: number; projects: number }> = {}
    const bump = (orgId: string, key: 'teams' | 'members' | 'workspaces' | 'projects') => {
      map[orgId] ??= { teams: 0, members: 0, workspaces: 0, projects: 0 }
      map[orgId][key] += 1
    }
    teams.forEach((t) => bump(t.orgId, 'teams'))
    members.forEach((m) => bump(m.orgId, 'members'))
    workspaces.forEach((w) => bump(w.orgId, 'workspaces'))
    projects.forEach((p) => bump(p.orgId, 'projects'))
    return map
  }, [])
}

export function usePlatformStats() {
  const orgs = useAllOrganizations()
  const users = useLiveQuery(() => db.users.count(), [])
  const tickets = useLiveQuery(() => db.tickets.toArray(), [])
  const plans = useLiveQuery(() => db.planConfigs.toArray(), [])

  if (!orgs || users === undefined || !tickets || !plans) return undefined

  const byPlan: Record<PlanTier, number> = { free: 0, pro: 0, business: 0 }
  for (const o of orgs) if (o.plan) byPlan[o.plan] += 1

  const priceByPlan = Object.fromEntries(plans.map((p) => [p.id, p.monthlyPrice ?? 0])) as Record<PlanTier, number>
  const mrr = orgs.reduce((sum, o) => sum + (o.status === 'active' && o.plan ? priceByPlan[o.plan] : 0), 0)

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length

  return {
    totalOrgs: orgs.length,
    activeOrgs: orgs.filter((o) => o.status === 'active').length,
    suspendedOrgs: orgs.filter((o) => o.status === 'suspended').length,
    totalUsers: users,
    byPlan,
    mrr,
    openTickets,
  }
}
