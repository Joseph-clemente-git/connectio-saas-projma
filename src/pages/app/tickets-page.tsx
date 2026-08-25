import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Lock, Plus } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { FeatureGate } from '@/components/shared/feature-lock'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TicketsListTab } from '@/components/tickets/tickets-list-tab'
import { TicketReportsTab } from '@/components/tickets/ticket-reports-tab'
import { TicketCategoriesTab } from '@/components/tickets/ticket-categories-tab'
import { TicketSlaTab } from '@/components/tickets/ticket-sla-tab'
import { TicketAutomationTab } from '@/components/tickets/ticket-automation-tab'
import { TicketFormsTab } from '@/components/tickets/ticket-forms-tab'
import { NewTicketDialog } from '@/components/tickets/new-ticket-dialog'
import { hasFeature } from '@/lib/entitlements'

export function TicketsPage() {
  const { org, plan, user } = useOutletContext<TenantOutletContext>()
  const categories = useLiveQuery(() => db.ticketCategories.where('orgId').equals(org.id).toArray(), [org.id]) ?? []
  const projects = useLiveQuery(() => db.projects.where('orgId').equals(org.id).toArray(), [org.id]) ?? []
  const escalatedCount = useLiveQuery(() => db.tickets.where('orgId').equals(org.id).filter((ticket) => Boolean(ticket.escalatedAt)).count(), [org.id]) ?? 0
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Tickets"
        description={`Client support requests across every ${org.name} project`}
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)} disabled={projects.length === 0}>
            <Plus className="size-4" /> New ticket
          </Button>
        }
      />

      <FeatureGate plan={plan} feature="projectTicketing" label="Project Ticketing">
        <div className="flex-1 p-6">
          {user.id === org.ownerId && escalatedCount > 0 && (
            <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div><p className="text-sm font-semibold text-foreground">{escalatedCount} internal escalation{escalatedCount === 1 ? '' : 's'} awaiting or recording a decision</p><p className="mt-1 text-xs text-muted-foreground">Escalated tickets are marked in the queue below. Open one to review the client, project, request, reason, conversation, attachments, and priority.</p></div>
            </div>
          )}
          <Tabs defaultValue="all">
            <div className="scrollbar-thin mb-5 overflow-x-auto">
              <TabsList className="w-max">
                <TabsTrigger value="all">All tickets</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="sla">{!hasFeature(plan, 'sla') && <Lock className="size-3" />} SLA</TabsTrigger>
                <TabsTrigger value="automation">
                  {!hasFeature(plan, 'ticketAutomation') && <Lock className="size-3" />} Automation
                </TabsTrigger>
                <TabsTrigger value="forms">
                  {!hasFeature(plan, 'customTicketForms') && <Lock className="size-3" />} Forms
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all">
              <TicketsListTab orgId={org.id} orgSlug={org.slug} />
            </TabsContent>
            <TabsContent value="reports">
              <TicketReportsTab orgId={org.id} level={plan.reportLevel} />
            </TabsContent>
            <TabsContent value="categories">
              <TicketCategoriesTab orgId={org.id} />
            </TabsContent>
            <TabsContent value="sla">
              <FeatureGate plan={plan} feature="sla" label="SLA">
                <TicketSlaTab orgId={org.id} />
              </FeatureGate>
            </TabsContent>
            <TabsContent value="automation">
              <FeatureGate plan={plan} feature="ticketAutomation" label="Ticket Automation">
                <TicketAutomationTab orgId={org.id} />
              </FeatureGate>
            </TabsContent>
            <TabsContent value="forms">
              <FeatureGate plan={plan} feature="customTicketForms" label="Custom Ticket Forms">
                <TicketFormsTab orgId={org.id} />
              </FeatureGate>
            </TabsContent>
          </Tabs>
        </div>
      </FeatureGate>

      <NewTicketDialog orgId={org.id} projects={projects} categories={categories} open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
