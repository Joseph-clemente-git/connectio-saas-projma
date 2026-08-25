import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Users2, Trash2, Crown, Pencil, Lock, Eye, AlertCircle } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import type { Team } from '@/types/domain'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LimitButton } from '@/components/shared/limit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useOrgMembersWithUsers, useOrgUsage, useOrgMemberRole } from '@/hooks/use-session-data'
import { canManageOrg } from '@/lib/permissions'
import { hasFeature } from '@/lib/entitlements'

export function TeamsPage() {
  const { org, user: currentUser, plan } = useOutletContext<TenantOutletContext>()
  const teams = useLiveQuery(() => db.teams.where('orgId').equals(org.id).toArray(), [org.id])
  const members = useOrgMembersWithUsers(org.id)
  const usage = useOrgUsage(org.id)
  const myMembership = useOrgMemberRole(org.id, currentUser.id)
  const canManage = canManageOrg(myMembership)
  const showReviewer = hasFeature(plan, 'projectTicketing')

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [leadId, setLeadId] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSelected, setEditSelected] = useState<string[]>([])
  const [editLeadId, setEditLeadId] = useState('')

  function resetForm() {
    setName('')
    setSelected([])
    setLeadId('')
  }

  async function createTeam() {
    if (!name.trim()) return
    await db.teams.add({
      id: crypto.randomUUID(),
      orgId: org.id,
      name: name.trim(),
      memberIds: selected,
      leadId: leadId || undefined,
      createdAt: new Date().toISOString(),
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      orgId: org.id,
      actorName: 'You',
      action: 'created team',
      target: name.trim(),
      createdAt: new Date().toISOString(),
    })
    setOpen(false)
    resetForm()
  }

  async function removeTeam(id: string) {
    await db.teams.delete(id)
  }

  function openEditTeam(team: Team) {
    setEditTeamId(team.id)
    setEditName(team.name)
    setEditSelected(team.memberIds)
    setEditLeadId(team.leadId ?? '')
    setEditOpen(true)
  }

  async function saveEditTeam() {
    if (!editTeamId || !editName.trim()) return
    await db.teams.update(editTeamId, {
      name: editName.trim(),
      memberIds: editSelected,
      leadId: editLeadId || undefined,
    })
    setEditOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Teams"
        description={`${usage?.teams ?? 0} team${usage?.teams === 1 ? '' : 's'} in ${org.name}`}
        actions={
          canManage ? (
            <LimitButton
              plan={plan}
              limitKey="teams"
              current={usage?.teams ?? 0}
              label="New team"
              onClick={() => setOpen(true)}
            />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Only owners &amp; admins can manage teams
            </span>
          )
        }
      />

      <div className="flex-1 p-6">
        {teams && teams.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const lead = team.leadId ? members?.find((m) => m.user.id === team.leadId) : undefined
              return (
                <Card key={team.id} className="group">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Users2 className="size-4" />
                      </div>
                      {team.name}
                    </CardTitle>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditTeam(team)}
                          aria-label={`Edit ${team.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTeam(team.id)}
                          aria-label={`Delete ${team.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Team leader</p>
                        {lead ? (
                          <div className="mt-1 flex items-center gap-2">
                            <InitialsAvatar name={lead.user.name} color={lead.user.avatarColor} className="size-7" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{lead.user.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{lead.user.title ?? 'No job title set'}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warning"><AlertCircle className="size-3.5" /> Leader not assigned</p>
                        )}
                      </div>
                      <Crown className="size-5 shrink-0 text-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {team.memberIds.slice(0, 5).map((id) => {
                          const entry = members?.find((m) => m.user.id === id)
                          return entry ? (
                            <InitialsAvatar
                              key={id}
                              name={entry.user.name}
                              color={entry.user.avatarColor}
                              className="size-7 border-2 border-card"
                            />
                          ) : null
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {team.memberIds.length} member{team.memberIds.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {showReviewer && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="size-3.5" />
                        {team.memberIds.filter((id) => {
                          const entry = members?.find((member) => member.user.id === id)
                          return entry && (entry.member.role !== 'member' || entry.member.canReview)
                        }).length} ticket reviewer(s)
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={Users2}
            title="No teams yet"
            description="Create your first team to start grouping members around the work they own."
            actionLabel={canManage ? 'New team' : undefined}
            onAction={canManage ? () => setOpen(true) : undefined}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>Give it a name and add members from {org.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform Team" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Members</Label>
              <div className="scrollbar-thin flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {members?.map(({ user }) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => (checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)))
                        if (!checked && leadId === user.id) setLeadId('')
                      }}
                    />
                    <InitialsAvatar name={user.name} color={user.avatarColor} className="size-6" />
                    <span className="min-w-0"><span className="block truncate text-sm text-foreground">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.title ?? 'No job title set'}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Team leader <span className="text-destructive">*</span></Label>
              <Select value={leadId || 'none'} onValueChange={(v) => setLeadId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No lead assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {members?.filter(({ user }) => selected.includes(user.id)).map(({ user }) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The leader is accountable for coordinating this team's work.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTeam} disabled={!name.trim() || !leadId}>
              Create team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
            <DialogDescription>Update the name, members, and lead for this team.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-team-name">Team name</Label>
              <Input id="edit-team-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Members</Label>
              <div className="scrollbar-thin flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {members?.map(({ user }) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={editSelected.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setEditSelected((prev) => (checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)))
                        if (!checked && editLeadId === user.id) setEditLeadId('')
                      }}
                    />
                    <InitialsAvatar name={user.name} color={user.avatarColor} className="size-6" />
                    <span className="min-w-0"><span className="block truncate text-sm text-foreground">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.title ?? 'No job title set'}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Team leader <span className="text-destructive">*</span></Label>
              <Select value={editLeadId || 'none'} onValueChange={(v) => setEditLeadId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No lead assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {members?.filter(({ user }) => editSelected.includes(user.id)).map(({ user }) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The leader is accountable for coordinating this team's work.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditTeam} disabled={!editName.trim() || !editLeadId}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
