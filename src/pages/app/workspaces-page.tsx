import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderKanban, ArrowRight } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LimitButton } from '@/components/shared/limit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useOrgUsage } from '@/hooks/use-session-data'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WORKFLOW_PRESETS, stagesForPreset, terminologyForPreset } from '@/lib/project-workflow'

export function WorkspacesPage() {
  const { org, plan } = useOutletContext<TenantOutletContext>()
  const navigate = useNavigate()
  const workspaces = useLiveQuery(() => db.workspaces.where('orgId').equals(org.id).toArray(), [org.id])
  const projectCounts = useLiveQuery(async () => {
    const projects = await db.projects.where('orgId').equals(org.id).toArray()
    const counts: Record<string, number> = {}
    for (const p of projects) counts[p.workspaceId] = (counts[p.workspaceId] ?? 0) + 1
    return counts
  }, [org.id])
  const usage = useOrgUsage(org.id)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workflowPreset, setWorkflowPreset] = useState('general')

  async function create() {
    if (!name.trim()) return
    await db.workspaces.add({
      id: crypto.randomUUID(),
      orgId: org.id,
      name: name.trim(),
      description: description.trim() || undefined,
      workflowPreset,
      workflowStages: stagesForPreset(workflowPreset),
      terminology: terminologyForPreset(workflowPreset),
      createdAt: new Date().toISOString(),
    })
    setOpen(false)
    setName('')
    setDescription('')
    setWorkflowPreset('general')
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Workspaces"
        description={`${usage?.workspaces ?? 0} workspace${usage?.workspaces === 1 ? '' : 's'} in ${org.name}`}
        actions={
          <LimitButton
            plan={plan}
            limitKey="workspaces"
            current={usage?.workspaces ?? 0}
            label="New workspace"
            onClick={() => setOpen(true)}
          />
        }
      />

      <div className="flex-1 p-6">
        {workspaces && workspaces.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Card
                key={ws.id}
                data-tour-workspace={ws.id}
                className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                onClick={() => navigate(`../workspaces/${ws.id}`)}
              >
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="size-4" />
                    </div>
                    <CardTitle className="text-base">{ws.name}</CardTitle>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{ws.description}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {projectCounts?.[ws.id] ?? 0} project{(projectCounts?.[ws.id] ?? 0) === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No workspaces yet"
            description="Workspaces group related projects together — create one to get started."
            actionLabel="New workspace"
            onAction={() => setOpen(true)}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>Group related projects together.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-workflow">Starting workflow</Label>
              <Select value={workflowPreset} onValueChange={setWorkflowPreset}>
                <SelectTrigger id="ws-workflow"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(WORKFLOW_PRESETS).map(([value, preset]) => <SelectItem key={value} value={value}>{preset.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sets neutral terminology and a default workflow. Each project can tailor its own stages later.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Input id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
