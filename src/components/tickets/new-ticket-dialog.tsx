import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { Project, TicketCategory, TicketPriority } from '@/types/domain'

export function NewTicketDialog({
  orgId,
  projects,
  lockedProjectId,
  categories,
  open,
  onOpenChange,
  source = 'internal',
}: {
  orgId: string
  /** Projects the ticket can be filed against. Omit when `lockedProjectId` is set. */
  projects?: Project[]
  /** Pin the ticket to one project (e.g. opened from that project's Support tab) and hide the picker. */
  lockedProjectId?: string
  categories: TicketCategory[]
  open: boolean
  onOpenChange: (v: boolean) => void
  source?: 'internal' | 'portal'
}) {
  const [projectId, setProjectId] = useState(lockedProjectId ?? '')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [categoryId, setCategoryId] = useState<string>('none')

  useEffect(() => {
    if (open) setProjectId(lockedProjectId ?? '')
  }, [open, lockedProjectId])

  const canCreate = Boolean(subject.trim() && projectId && clientName.trim() && clientEmail.trim())

  async function create() {
    if (!canCreate) return
    const now = new Date().toISOString()
    await db.tickets.add({
      id: crypto.randomUUID(),
      orgId,
      projectId,
      categoryId: categoryId === 'none' ? undefined : categoryId,
      subject: subject.trim(),
      description: description.trim(),
      status: 'open',
      priority,
      submitterName: clientName.trim(),
      submitterEmail: clientEmail.trim(),
      source,
      approval: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    setProjectId(lockedProjectId ?? '')
    setClientName('')
    setClientEmail('')
    setSubject('')
    setDescription('')
    setPriority('medium')
    setCategoryId('none')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>Log a support request from your client. It'll wait for approval before becoming a task.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!lockedProjectId && (
            <div className="flex flex-col gap-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Which project is this for?" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-client-name">Client name</Label>
              <Input id="ticket-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jane Cooper" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-client-email">Client email</Label>
              <Input
                id="ticket-client-email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="jane@client.com"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-desc">Description</Label>
            <textarea
              id="ticket-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!canCreate}>
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
