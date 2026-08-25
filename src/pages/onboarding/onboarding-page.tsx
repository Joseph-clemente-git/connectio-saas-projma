import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Check, CheckCircle2, Clipboard, FolderKanban, LoaderCircle, MailPlus, Sparkles, Waypoints } from 'lucide-react'
import { db } from '@/db/schema'
import { useSession } from '@/store/session'
import { provisionInvitedMember } from '@/lib/auth'
import { PLAN_ORDER } from '@/lib/plans'
import { WORKFLOW_PRESETS, stagesForPreset, terminologyForPreset } from '@/lib/project-workflow'
import type { Organization, PlanTier } from '@/types/domain'
import { setOrganizationPlan } from '@/lib/subscriptions'
import { linkRegistrationEventsToOrganization } from '@/lib/billing-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingScreen } from '@/components/shared/loading-screen'

const STEP_INDEX = { organization: 0, plan: 1, workspace: 2, invite: 3 } as const
const STEPS = ['Organization', 'Plan', 'Workspace', 'Team']

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48)
}

function formatLimit(value: number | null, noun: string) {
  return value === null ? `Unlimited ${noun}` : `${value} ${noun}`
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const userId = useSession((state) => state.userId)
  const preferredOrgId = useSession((state) => state.orgId)
  const switchOrg = useSession((state) => state.switchOrg)
  const context = useLiveQuery(async () => {
    if (!userId) return null
    const user = await db.users.get(userId)
    const memberships = await db.orgMembers.where('userId').equals(userId).toArray()
    const membership = memberships.find((entry) => entry.orgId === preferredOrgId) ?? memberships.find((entry) => entry.role === 'owner') ?? memberships[0]
    const org = membership ? await db.organizations.get(membership.orgId) : undefined
    const plans = await db.planConfigs.toArray()
    const workspaces = org ? await db.workspaces.where('orgId').equals(org.id).toArray() : []
    return { user, membership, org, plans, workspaces }
  }, [preferredOrgId, userId])

  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')
  const [workflowPreset, setWorkflowPreset] = useState('general')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteDetails, setInviteDetails] = useState<{ email: string; invitationUrl: string; temporaryPassword?: string }[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const stage = !context?.membership || !context.org
    ? 'organization'
    : context.org.onboardingStep === 'complete' ? 'complete' : context.org.onboardingStep

  useEffect(() => {
    if (stage === 'complete' && context?.org) navigate(`/app/${context.org.slug}/dashboard`, { replace: true })
  }, [context?.org, navigate, stage])

  const currentIndex = stage === 'complete' ? 4 : STEP_INDEX[stage]
  const sortedPlans = useMemo(() => [...(context?.plans ?? [])].sort((left, right) => PLAN_ORDER.indexOf(left.id) - PLAN_ORDER.indexOf(right.id)), [context?.plans])

  if (context === undefined) return <LoadingScreen />
  if (!context?.user) return null
  if (context.user.role === 'super_admin') return <Navigate to="/admin/dashboard" replace />

  async function run(action: () => Promise<void>) {
    setError('')
    setSubmitting(true)
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong.') } finally { setSubmitting(false) }
  }

  async function createOrganization() {
    const user = context?.user
    if (!user) return
    await run(async () => {
      const name = orgName.trim()
      if (name.length < 2) throw new Error('Enter an organization name.')
      const baseSlug = slugify(name) || 'organization'
      let slug = baseSlug
      if (await db.organizations.where('slug').equals(slug).first()) slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const org: Organization = { id, name, slug, status: 'active', ownerId: user.id, logoColor: '#2563EB', industry: industry.trim() || undefined, onboardingStep: 'plan', createdAt: now }
      await db.transaction('rw', [db.organizations, db.orgMembers, db.billingEvents, db.auditLogs], async () => {
        await db.organizations.add(org)
        await db.orgMembers.add({ id: crypto.randomUUID(), orgId: id, userId: user.id, role: 'owner', teamIds: [], joinedAt: now })
        await db.billingEvents.add({
          id: crypto.randomUUID(), correlationId: crypto.randomUUID(), orgId: id, userId: user.id,
          event: 'organization.created', status: 'succeeded', message: `Organization ${name} created.`, createdAt: now,
        })
        await db.auditLogs.add({ id: crypto.randomUUID(), orgId: id, actorName: user.name, action: 'created organization', target: name, createdAt: now })
      })
      await linkRegistrationEventsToOrganization(user.id, id)
      switchOrg(id)
    })
  }

  async function selectPlan(planId: PlanTier) {
    const org = context?.org
    if (!org) return
    await run(async () => {
      await setOrganizationPlan(org.id, planId, context?.user?.name ?? 'Organization owner')
      await db.organizations.update(org.id, { onboardingStep: 'workspace' })
    })
  }

  async function createWorkspace() {
    const org = context?.org
    if (!org) return
    await run(async () => {
      if (!workspaceName.trim()) throw new Error('Enter a workspace name.')
      await db.transaction('rw', [db.workspaces, db.organizations], async () => {
        await db.workspaces.add({
          id: crypto.randomUUID(), orgId: org.id, name: workspaceName.trim(),
          description: workspaceDescription.trim() || undefined, workflowPreset,
          workflowStages: stagesForPreset(workflowPreset), terminology: terminologyForPreset(workflowPreset),
          createdAt: new Date().toISOString(),
        })
        await db.organizations.update(org.id, { onboardingStep: 'invite' })
      })
    })
  }

  async function inviteMember() {
    const org = context?.org
    const user = context?.user
    if (!org || !user || !context) return
    await run(async () => {
      const result = await provisionInvitedMember({ orgId: org.id, inviterId: user.id, name: inviteName, email: inviteEmail, role: inviteRole, workspaceIds: context.workspaces.map((workspace) => workspace.id) })
      const invitationUrl = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`
      setInviteDetails((entries) => [...entries, { email: result.user.email, invitationUrl, temporaryPassword: result.temporaryPassword }])
      setInviteName('')
      setInviteEmail('')
      setInviteRole('member')
    })
  }

  async function completeOnboarding() {
    const org = context?.org
    if (!org) return
    await run(async () => {
      if (!org.plan) throw new Error('Select a plan before completing onboarding.')
      const workspaceCount = await db.workspaces.where('orgId').equals(org.id).count()
      if (!workspaceCount) throw new Error('Create a workspace before completing onboarding.')
      const now = new Date().toISOString()
      await db.transaction('rw', [db.organizations, db.billingEvents, db.auditLogs], async () => {
        await db.organizations.update(org.id, { onboardingStep: 'complete', onboardingCompletedAt: now })
        await db.billingEvents.add({
          id: crypto.randomUUID(), correlationId: crypto.randomUUID(), orgId: org.id, userId: context?.user?.id,
          event: 'onboarding.completed', status: 'succeeded', message: 'Organization onboarding completed.', createdAt: now,
        })
        await db.auditLogs.add({
          id: crypto.randomUUID(), orgId: org.id, actorName: context?.user?.name ?? 'Organization owner',
          action: 'completed onboarding', target: org.name, createdAt: now,
        })
      })
      navigate(`/app/${org.slug}/dashboard`, { replace: true })
    })
  }

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b border-border bg-card/85 px-4 py-4 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Waypoints className="size-5" /></span>Connectio</div><span className="text-sm text-muted-foreground">Signed in as {context.user.email}</span></div></header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-10">
          <p className="text-sm font-semibold text-primary">Organization setup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Build your clean workspace</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Only the essentials now. You can configure projects, workflows, and more after setup.</p>
        </div>
        <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Onboarding progress">{STEPS.map((label, index) => <li key={label} className="min-w-0"><div className={`h-1.5 rounded-full ${index <= currentIndex ? 'bg-primary' : 'bg-muted'}`} /><span className={`mt-2 block truncate text-xs font-semibold ${index === currentIndex ? 'text-foreground' : 'text-muted-foreground'}`}>{index + 1}. {label}</span></li>)}</ol>

        {error && <div role="alert" className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        {stage === 'organization' && <Card className="max-w-2xl"><CardHeader><div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 /></div><CardTitle>Create your organization</CardTitle><CardDescription>This creates the tenant and your explicit Owner membership. It does not create projects or sample work.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="org-name">Organization name</Label><Input id="org-name" autoFocus value={orgName} onChange={(event) => setOrgName(event.target.value)} placeholder="Acme Studio" /></div><div className="space-y-2"><Label htmlFor="industry">Industry <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="industry" value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Consulting, construction, software…" /></div><Button size="lg" onClick={() => void createOrganization()} disabled={submitting || orgName.trim().length < 2}>{submitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}Create organization</Button></CardContent></Card>}

        {stage === 'plan' && <section><div className="mb-6"><h2 className="text-2xl font-bold">Choose a plan</h2><p className="mt-1 text-sm text-muted-foreground">These options are loaded from the platform’s Plan records.</p></div><div className="grid gap-5 md:grid-cols-3">{sortedPlans.map((plan) => <Card key={plan.id} className={plan.id === 'pro' ? 'border-primary shadow-md' : ''}><CardHeader>{plan.id === 'pro' && <Badge className="mb-2 w-fit">Popular</Badge>}<CardTitle>{plan.name}</CardTitle><CardDescription>{plan.tagline}</CardDescription><div className="pt-4"><span className="text-3xl font-bold">${plan.monthlyPrice ?? 0}</span><span className="text-sm text-muted-foreground"> / month</span></div></CardHeader><CardContent className="space-y-4"><ul className="space-y-2 text-sm text-muted-foreground"><li className="flex gap-2"><Check className="size-4 text-success" />{formatLimit(plan.limits.members, 'members')}</li><li className="flex gap-2"><Check className="size-4 text-success" />{formatLimit(plan.limits.workspaces, 'workspaces')}</li><li className="flex gap-2"><Check className="size-4 text-success" />{formatLimit(plan.limits.projects, 'projects')}</li></ul><Button variant={plan.id === 'pro' ? 'primary' : 'outline'} className="w-full" onClick={() => void selectPlan(plan.id)} disabled={submitting}>Select {plan.name}</Button></CardContent></Card>)}</div></section>}

        {stage === 'workspace' && <Card className="max-w-2xl"><CardHeader><div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderKanban /></div><CardTitle>Create your first workspace</CardTitle><CardDescription>A workspace groups related projects. It starts empty—no sample projects, sprints, or tasks.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Client delivery" /></div><div className="space-y-2"><Label htmlFor="workflow-preset">Starting workflow</Label><Select value={workflowPreset} onValueChange={setWorkflowPreset}><SelectTrigger id="workflow-preset"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORKFLOW_PRESETS).map(([value, preset]) => <SelectItem key={value} value={value}>{preset.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Creates only the workflow configuration required by this workspace.</p></div><div className="space-y-2"><Label htmlFor="workspace-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="workspace-description" value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} /></div><Button size="lg" onClick={() => void createWorkspace()} disabled={submitting || !workspaceName.trim()}>{submitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}Create workspace</Button></CardContent></Card>}

        {stage === 'invite' && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"><Card><CardHeader><div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><MailPlus /></div><CardTitle>Invite your team</CardTitle><CardDescription>Optional. Share an invitation link; access starts only after the recipient accepts and creates a password.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="invite-name">Full name</Label><Input id="invite-name" value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Alex Morgan" /></div><div className="space-y-2"><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" /></div><div className="space-y-2 sm:max-w-48"><Label>Role</Label><Select value={inviteRole} onValueChange={(value) => setInviteRole(value as 'admin' | 'member')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div></div><div className="flex flex-wrap gap-3"><Button onClick={() => void inviteMember()} disabled={submitting || !inviteName.trim() || !inviteEmail.trim()}><MailPlus />Invite member</Button><Button variant="outline" onClick={() => void completeOnboarding()} disabled={submitting}>Skip for now</Button></div>{inviteDetails.length > 0 && <div className="space-y-3 border-t border-border pt-5"><h3 className="text-sm font-semibold">Invitation details</h3>{inviteDetails.map((entry) => <div key={entry.email} className="rounded-lg border border-success/20 bg-success/5 p-3"><p className="text-sm font-medium">{entry.email}</p><p className="mt-1 text-xs text-muted-foreground">Accept invitation → create new password → enter organization.</p><div className="mt-2 grid gap-2"><div className="flex gap-2"><Input readOnly value={entry.invitationUrl} className="h-10 text-xs" aria-label={`Invitation link for ${entry.email}`} /><Button type="button" variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(entry.invitationUrl)} aria-label={`Copy invitation link for ${entry.email}`}><Clipboard /></Button></div>{entry.temporaryPassword && <div className="flex gap-2"><Input readOnly value={entry.temporaryPassword} className="h-10 font-mono text-sm" aria-label={`Temporary password for ${entry.email}`} /><Button type="button" variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(entry.temporaryPassword ?? '')} aria-label={`Copy temporary password for ${entry.email}`}><Clipboard /></Button></div>}</div></div>)}</div>}</CardContent></Card><Card><CardHeader><div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-success/10 text-success"><Sparkles /></div><CardTitle>Ready when you are</CardTitle><CardDescription>You can invite more people later from Members.</CardDescription></CardHeader><CardContent><Button size="lg" className="w-full" onClick={() => void completeOnboarding()} disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}Complete setup</Button></CardContent></Card></div>}
      </div>
    </main>
  )
}
