import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Workflow } from 'lucide-react'
import { db } from '@/db/schema'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function TicketAutomationTab({ orgId }: { orgId: string }) {
  const rules = useLiveQuery(() => db.ticketAutomations.where('orgId').equals(orgId).toArray(), [orgId])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  async function create() {
    if (!name.trim()) return
    await db.ticketAutomations.add({
      id: crypto.randomUUID(),
      orgId,
      name: name.trim(),
      triggerField: 'priority',
      triggerValue: 'urgent',
      action: 'notify',
      actionValue: 'on-call',
      enabled: true,
    })
    setName('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New rule
        </Button>
      </div>

      {rules && rules.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    When <span className="font-medium">{r.triggerField}</span> is{' '}
                    <span className="font-medium">{r.triggerValue}</span> → {r.action.replace('_', ' ')}{' '}
                    <span className="font-medium">{r.actionValue}</span>
                  </p>
                </div>
                <Switch checked={r.enabled} onCheckedChange={(v) => db.ticketAutomations.update(r.id, { enabled: v })} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Workflow} title="No automation rules" description="Automatically assign, prioritize, or notify based on ticket conditions." />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New automation rule</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Escalate urgent tickets" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              Create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
