import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldCheck } from 'lucide-react'
import { db } from '@/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { TICKET_PRIORITY_LABEL } from '@/lib/ticket-ui'

function minutesToLabel(mins: number) {
  if (mins % 1440 === 0) return `${mins / 1440} day${mins / 1440 === 1 ? '' : 's'}`
  if (mins % 60 === 0) return `${mins / 60} hour${mins / 60 === 1 ? '' : 's'}`
  return `${mins} min`
}

export function TicketSlaTab({ orgId }: { orgId: string }) {
  const policies = useLiveQuery(() => db.slaPolicies.where('orgId').equals(orgId).toArray(), [orgId])

  if (policies && policies.length === 0) {
    return <EmptyState icon={ShieldCheck} title="No SLA policies" description="SLA policies define response and resolution targets per priority." />
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {policies?.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{p.name}</span>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {TICKET_PRIORITY_LABEL[p.priority]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">First response</Label>
                <Input
                  type="number"
                  min={5}
                  value={p.firstResponseMins}
                  onChange={(e) => db.slaPolicies.update(p.id, { firstResponseMins: Number(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted-foreground">{minutesToLabel(p.firstResponseMins)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Resolution</Label>
                <Input
                  type="number"
                  min={5}
                  value={p.resolutionMins}
                  onChange={(e) => db.slaPolicies.update(p.id, { resolutionMins: Number(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted-foreground">{minutesToLabel(p.resolutionMins)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
