import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { UserCircle, ShieldCheck, Lock, Eye, Crown, FolderKanban, Pencil, Users2, Clipboard } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LimitButton } from '@/components/shared/limit-button'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useOrgMembersWithUsers, useOrgUsage, useOrgMemberRole } from '@/hooks/use-session-data'
import { hasFeature, limitLabel } from '@/lib/entitlements'
import { canManageOrg } from '@/lib/permissions'
import { format } from 'date-fns'
import { provisionInvitedMember } from '@/lib/auth'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

export function MembersPage() {
  const { org, user: currentUser, plan } = useOutletContext<TenantOutletContext>()
  const members = useOrgMembersWithUsers(org.id)
  const usage = useOrgUsage(org.id)
  const teams = useLiveQuery(() => db.teams.where('orgId').equals(org.id).toArray(), [org.id])
  const projects = useLiveQuery(() => db.projects.where('orgId').equals(org.id).toArray(), [org.id])
  const workspaces = useLiveQuery(() => db.workspaces.where('orgId').equals(org.id).toArray(), [org.id])
  const myMembership = useOrgMemberRole(org.id, currentUser.id)
  const canManage = canManageOrg(myMembership)
  const showReviewer = hasFeature(plan, 'projectTicketing')

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [canReview, setCanReview] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; temporaryPassword?: string; invitationUrl: string } | null>(null)
  const [inviteError, setInviteError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editMemberId, setEditMemberId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editRole, setEditRole] = useState<'owner' | 'admin' | 'member'>('member')
  const [editCanReview, setEditCanReview] = useState(false)

  const reviewerCount = useMemo(
    () => members?.filter(({ member }) => member.role !== 'member' || member.canReview).length ?? 0,
    [members],
  )
  const teamLeadCount = useMemo(() => new Set(teams?.map((team) => team.leadId).filter(Boolean)).size, [teams])

  async function invite() {
    if (!name.trim() || !email.trim()) return
    setInviteError('')
    try {
      const result = await provisionInvitedMember({ orgId: org.id, inviterId: currentUser.id, name, email, role, workspaceIds: workspaces?.map((workspace) => workspace.id), canReview: role === 'member' && showReviewer ? canReview : undefined })
      const invitationUrl = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`
      setInviteResult({ email: result.user.email, temporaryPassword: result.temporaryPassword, invitationUrl })
      await db.auditLogs.add({ id: crypto.randomUUID(), orgId: org.id, actorName: currentUser.name, action: 'invited organization member', target: result.user.email, createdAt: new Date().toISOString() })
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : 'Unable to create this invitation.')
    }
  }

  async function removeMember(memberId: string, userId: string) {
    await db.orgMembers.delete(memberId)
    const projectIds = new Set((projects ?? []).map((project) => project.id))
    const affectedTasks = (await db.tasks.toArray()).filter(
      (task) => projectIds.has(task.projectId) && (task.assigneeId === userId || task.reviewerId === userId),
    )
    await Promise.all(
      [
        ...(teams ?? []).map((team) =>
          db.teams.update(team.id, {
            memberIds: team.memberIds.filter((id) => id !== userId),
            leadId: team.leadId === userId ? undefined : team.leadId,
          }),
        ),
        ...(projects ?? [])
          .filter((project) => project.leadId === userId || project.coordinatorId === userId || project.reviewerId === userId)
          .map((project) => db.projects.update(project.id, {
            leadId: project.leadId === userId ? undefined : project.leadId,
            coordinatorId: project.coordinatorId === userId ? undefined : project.coordinatorId,
            reviewerId: project.reviewerId === userId ? undefined : project.reviewerId,
          })),
        ...affectedTasks.map((task) => db.tasks.update(task.id, {
          assigneeId: task.assigneeId === userId ? undefined : task.assigneeId,
          reviewerId: task.reviewerId === userId ? undefined : task.reviewerId,
          status: task.status === 'done' ? 'in_progress' : task.status,
          reviewState: undefined,
          reviewedAt: undefined,
        })),
      ],
    )
  }

  function openEdit(
    targetUser: { id: string; name: string; title?: string },
    membership: { id: string; role: 'owner' | 'admin' | 'member'; canReview?: boolean },
  ) {
    setEditUserId(targetUser.id)
    setEditMemberId(membership.id)
    setEditName(targetUser.name)
    setEditTitle(targetUser.title ?? '')
    setEditRole(membership.role)
    setEditCanReview(membership.canReview === true)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editUserId || !editMemberId || !editName.trim()) return
    await db.transaction('rw', [db.users, db.orgMembers], async () => {
      await db.users.update(editUserId, { name: editName.trim(), title: editTitle.trim() || undefined })
      await db.orgMembers.update(editMemberId, {
        role: editRole,
        canReview: editRole === 'member' && showReviewer ? editCanReview : undefined,
      })
    })
    setEditOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Members"
        description={`${usage?.members ?? 0} member${usage?.members === 1 ? '' : 's'} in ${org.name}`}
        actions={
          canManage ? (
            <LimitButton
              plan={plan}
              limitKey="members"
              current={usage?.members ?? 0}
              label="Invite member"
              onClick={() => {
                setName('')
                setEmail('')
                setInviteResult(null)
                setInviteError('')
                setOpen(true)
              }}
            />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Only owners &amp; admins can invite members
            </span>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-muted/20 px-6 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-accent" /> Owner — full control
        </span>
        <span>Admin — manages members &amp; teams</span>
        <span>Member — works within assigned teams</span>
        {showReviewer && (
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" /> Reviewer — can approve/reject tickets
          </span>
        )}
      </div>

      <div className="flex-1 p-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users2 className="size-4" /> Plan capacity</div>
            <p className="mt-2 text-xl font-semibold text-foreground">{usage?.members ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {limitLabel(plan.limits.members)}</span></p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Crown className="size-4 text-accent" /> Team leaders</div>
            <p className="mt-2 text-xl font-semibold text-foreground">{teamLeadCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Eye className="size-4 text-primary" /> Ticket reviewers</div>
            <p className="mt-2 text-xl font-semibold text-foreground">{showReviewer ? reviewerCount : 'Not in plan'}</p>
          </div>
        </div>
        {members && members.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Job title</th>
                  <th className="px-4 py-3 font-medium">Responsibilities</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Management</th>
                </tr>
              </thead>
              <tbody>
                {members.map(({ member, user }) => {
                  const ledTeams = teams?.filter((team) => team.leadId === user.id) ?? []
                  const ledProjects = projects?.filter((project) => project.leadId === user.id) ?? []
                  const coordinatedProjects = projects?.filter((project) => project.coordinatorId === user.id) ?? []
                  const reviewedProjects = projects?.filter((project) => project.reviewerId === user.id) ?? []
                  const isReviewer = showReviewer && (member.role !== 'member' || member.canReview === true)
                  const canEditTarget = myMembership?.role === 'owner' || member.role !== 'owner'
                  return (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={user.name} color={user.avatarColor} className="size-8" />
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={member.role === 'owner' ? 'accent' : 'secondary'} className="gap-1">
                        {member.role === 'owner' && <ShieldCheck className="size-3" />}
                        {ROLE_LABEL[member.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.title ?? 'Not set'}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {ledTeams.map((team) => <Badge key={team.id} variant="warning"><Crown className="size-3" /> Leads {team.name}</Badge>)}
                        {ledProjects.length > 0 && <Badge variant="outline"><FolderKanban className="size-3" /> Leads {ledProjects.length} project{ledProjects.length === 1 ? '' : 's'}</Badge>}
                        {coordinatedProjects.length > 0 && <Badge variant="outline">Coordinates {coordinatedProjects.length} project{coordinatedProjects.length === 1 ? '' : 's'}</Badge>}
                        {reviewedProjects.length > 0 && <Badge variant="secondary"><Eye className="size-3" /> Reviews {reviewedProjects.length} project{reviewedProjects.length === 1 ? '' : 's'}</Badge>}
                        {isReviewer && <Badge variant="secondary"><Eye className="size-3" /> Ticket reviewer</Badge>}
                        {ledTeams.length === 0 && ledProjects.length === 0 && coordinatedProjects.length === 0 && reviewedProjects.length === 0 && !isReviewer && <span className="text-xs text-muted-foreground">Contributor</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(member.joinedAt), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage && canEditTarget && (
                        <Button variant="outline" size="sm" className="min-h-10" onClick={() => openEdit(user, member)}>
                          <Pencil className="size-3.5" /> Manage
                        </Button>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={UserCircle} title="No members yet" description="Invite teammates to get started." />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>Create a secure invitation link. Membership is granted only after the recipient accepts and creates a private password.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={Boolean(inviteResult)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-email">Email</Label>
              <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={Boolean(inviteResult)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')} disabled={Boolean(inviteResult)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Admins manage members, teams, and team leaders. Members work within assigned teams.</p>
            </div>
            {showReviewer && role === 'member' && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
                <span><span className="block text-sm font-medium text-foreground">Ticket reviewer</span><span className="block text-xs text-muted-foreground">Can inspect, approve, or reject incoming tickets.</span></span>
                <Switch checked={canReview} onCheckedChange={setCanReview} aria-label="Grant ticket reviewer access" />
              </label>
            )}
            {inviteError && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{inviteError}</div>}
            {inviteResult && <div className="rounded-lg border border-success/20 bg-success/5 p-4" role="status"><p className="text-sm font-semibold text-foreground">Invitation ready to share</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The recipient reviews the invitation, selects Accept invitation, then creates a new password before entering the organization.</p><div className="mt-3 grid gap-3"><div><Label htmlFor="invitation-url" className="text-xs">Invitation link</Label><div className="mt-1 flex gap-2"><Input id="invitation-url" readOnly value={inviteResult.invitationUrl} className="h-10 text-xs" /><Button type="button" variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(inviteResult.invitationUrl)} aria-label="Copy invitation link"><Clipboard /></Button></div></div>{inviteResult.temporaryPassword && <div><Label htmlFor="temporary-password" className="text-xs">Temporary password</Label><div className="mt-1 flex gap-2"><Input id="temporary-password" readOnly value={inviteResult.temporaryPassword} className="h-10 font-mono text-sm" /><Button type="button" variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(inviteResult.temporaryPassword ?? '')} aria-label="Copy temporary password"><Clipboard /></Button></div><p className="mt-1 text-xs text-muted-foreground">Fallback sign-in credential. It cannot be used to bypass the required new-password step.</p></div>}<Button type="button" variant="outline" className="w-full" onClick={() => void navigator.clipboard.writeText(`Connectio invitation: ${inviteResult.invitationUrl}\nEmail: ${inviteResult.email}${inviteResult.temporaryPassword ? `\nTemporary password: ${inviteResult.temporaryPassword}` : ''}`)}><Clipboard />Copy invitation details</Button></div></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={invite} disabled={!name.trim() || !email.trim() || Boolean(inviteResult)}>
              Invite member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage member</DialogTitle>
            <DialogDescription>Update this person's profile, organization access, and review responsibility.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-member-name">Name</Label>
              <Input id="edit-member-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-member-title">Job title</Label>
              <Input
                id="edit-member-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Product Manager"
              />
              <p className="text-xs text-muted-foreground">Examples: Engineering Manager, Product Designer, Support Lead.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Organization role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as 'owner' | 'admin' | 'member')} disabled={editRole === 'owner'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editRole === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Admins can manage members, teams, and leaders. Ownership cannot be changed here.</p>
            </div>
            {showReviewer && editRole === 'member' && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
                <span><span className="block text-sm font-medium text-foreground">Ticket reviewer</span><span className="block text-xs text-muted-foreground">Can inspect, approve, or reject incoming tickets.</span></span>
                <Switch checked={editCanReview} onCheckedChange={setEditCanReview} aria-label="Grant ticket reviewer access" />
              </label>
            )}
          </div>
          <DialogFooter>
            {editRole !== 'owner' && editUserId !== currentUser.id && (
              <Button variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={() => {
                if (editMemberId && editUserId) void removeMember(editMemberId, editUserId)
                setEditOpen(false)
              }}>
                Remove member
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
