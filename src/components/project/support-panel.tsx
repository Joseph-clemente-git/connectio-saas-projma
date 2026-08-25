import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Copy, ExternalLink, Plus } from 'lucide-react'
import { db } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NewTicketDialog } from '@/components/tickets/new-ticket-dialog'
import { TicketsListTab } from '@/components/tickets/tickets-list-tab'
import { hasFeature } from '@/lib/entitlements'
import type { PlanConfig } from '@/lib/plans'

export function SupportPanel({
  orgId,
  orgSlug,
  projectId,
  plan,
}: {
  orgId: string
  orgSlug: string
  projectId: string
  plan: PlanConfig
}) {
  const categories = useLiveQuery(() => db.ticketCategories.where('orgId').equals(orgId).toArray(), [orgId]) ?? []
  const [newOpen, setNewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const portalUrl = `${window.location.origin}/portal/${orgSlug}/${projectId}`

  async function copyLink() {
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {hasFeature(plan, 'publicTicketPortal') && (
        <Card>
          <CardHeader>
            <CardTitle>Client portal</CardTitle>
            <CardDescription>Share this link with your client so they can submit support requests for this project.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {portalUrl}
            </code>
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Tickets</h3>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New ticket
          </Button>
        </div>
        <TicketsListTab orgId={orgId} orgSlug={orgSlug} projectId={projectId} />
      </div>

      <NewTicketDialog orgId={orgId} lockedProjectId={projectId} categories={categories} open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
