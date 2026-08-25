import { db, type FeatureFlag } from '@/db/schema'
import { createCredential, normalizeEmail } from '@/lib/auth'
import { DEFAULT_PLANS } from '@/lib/plans'
import type { User } from '@/types/domain'

export const SUPER_ADMIN = {
  id: 'user-super-admin',
  email: normalizeEmail(import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'admin@connectio.app'),
  /** Development bootstrap only. Override it with VITE_SUPER_ADMIN_PASSWORD. */
  password: import.meta.env.VITE_SUPER_ADMIN_PASSWORD || 'ConnectioAdmin!2026',
} as const

const PLATFORM_SEED_VERSION = '2'

const SYSTEM_FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'ff-public-signups', name: 'Public signups', description: 'Allow verified users to create an organization.', enabled: true },
  { id: 'ff-ai-suggestions', name: 'AI task suggestions', description: 'Enable AI-assisted task breakdowns.', enabled: false },
  { id: 'ff-new-billing', name: 'New billing flow', description: 'Enable the next billing experience.', enabled: false },
  { id: 'ff-automation-beta', name: 'Ticket automation v2', description: 'Enable next-generation ticket automations.', enabled: true },
  { id: 'ff-maintenance-mode', name: 'Maintenance mode', description: 'Pause tenant writes platform-wide.', enabled: false },
]

async function clearLegacyDemoData(): Promise<void> {
  const legacySeed = await db.meta.get('seeded')
  const migrated = await db.meta.get('platform-seed-version')
  if (!legacySeed || migrated) return
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.filter((table) => table.name !== 'planConfigs' && table.name !== 'meta').map((table) => table.clear()))
    await db.meta.delete('seeded')
  })
}

/** Seeds platform configuration only. Tenant data is created through onboarding. */
export async function seedDatabase(): Promise<void> {
  await clearLegacyDemoData()
  for (const plan of Object.values(DEFAULT_PLANS)) {
    if (!await db.planConfigs.get(plan.id)) await db.planConfigs.add(plan)
  }
  for (const featureFlag of SYSTEM_FEATURE_FLAGS) {
    if (!await db.featureFlags.get(featureFlag.id)) await db.featureFlags.add(featureFlag)
  }

  let superAdmin = await db.users.get(SUPER_ADMIN.id)
  if (!superAdmin) {
    const now = new Date().toISOString()
    superAdmin = {
      id: SUPER_ADMIN.id,
      name: 'Connectio Super Admin',
      email: SUPER_ADMIN.email,
      avatarColor: '#1E293B',
      role: 'super_admin',
      verificationStatus: 'verified',
      verifiedAt: now,
      title: 'Platform Super Admin',
      createdAt: now,
    } satisfies User
    await db.users.add(superAdmin)
  } else if (superAdmin.verificationStatus !== 'verified') {
    await db.users.update(superAdmin.id, { verificationStatus: 'verified', verifiedAt: new Date().toISOString() })
  }
  if (!await db.authCredentials.get(SUPER_ADMIN.id)) await createCredential(SUPER_ADMIN.id, SUPER_ADMIN.password)
  await db.meta.put({ key: 'platform-seed-version', value: PLATFORM_SEED_VERSION })
}

/** Removes tenant and regular-account data while preserving Plans and Super Admin access. */
export async function resetDatabase(): Promise<void> {
  const tenantTables = [
    db.organizations, db.subscriptions, db.orgMembers, db.teams, db.workspaces, db.projects,
    db.links, db.pins, db.announcements, db.releaseNotes, db.sprints, db.tasks, db.subtasks,
    db.taskComments, db.taskAttachments, db.taskCommentReadStates, db.milestones, db.tickets,
    db.ticketCategories, db.ticketAttachments, db.ticketComments, db.ticketActivities, db.slaPolicies,
    db.ticketAutomations, db.customTicketForms, db.apiKeys, db.auditLogs, db.chatConversations,
    db.chatMessages, db.chatReadStates, db.files, db.recurringReports, db.calendarEvents,
    db.workflowSets, db.invoices, db.payments, db.invitations,
  ]
  const regularUsers = await db.users.filter((user) => user.role !== 'super_admin').toArray()
  const regularUserIds = regularUsers.map((user) => user.id)
  await db.transaction('rw', [...tenantTables, db.users, db.authCredentials, db.authSessions, db.verificationTokens], async () => {
    await Promise.all(tenantTables.map((table) => table.clear()))
    if (regularUserIds.length) {
      await db.users.bulkDelete(regularUserIds)
      await db.authCredentials.bulkDelete(regularUserIds)
      const sessions = await db.authSessions.where('userId').anyOf(regularUserIds).primaryKeys()
      const tokens = await db.verificationTokens.where('userId').anyOf(regularUserIds).primaryKeys()
      await db.authSessions.bulkDelete(sessions)
      await db.verificationTokens.bulkDelete(tokens)
    }
  })
  await seedDatabase()
}
