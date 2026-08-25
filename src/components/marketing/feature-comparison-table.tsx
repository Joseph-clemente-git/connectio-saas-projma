import { Check, Minus } from 'lucide-react'
import { PLAN_ORDER, DEFAULT_PLANS, FEATURE_LABELS, type FeatureKey, type PlanConfig } from '@/lib/plans'
import { limitLabel } from '@/lib/entitlements'
import { cn } from '@/lib/utils'

type CellValue = boolean | string

interface Row {
  label: string
  value: (plan: PlanConfig) => CellValue
}

const LIMIT_ROWS: Row[] = [
  { label: 'Organizations', value: () => true },
  { label: 'Teams', value: (p) => limitLabel(p.limits.teams) },
  { label: 'Members', value: (p) => limitLabel(p.limits.members) },
  { label: 'Workspaces', value: (p) => limitLabel(p.limits.workspaces) },
  { label: 'Projects', value: (p) => limitLabel(p.limits.projects) },
  { label: 'Storage', value: (p) => `${p.limits.storageGb} GB` },
  { label: 'Sprints', value: () => true },
  { label: 'Tasks', value: () => true },
  { label: 'SubTasks', value: () => true },
  { label: 'Basic Monitoring', value: () => true },
]

const FEATURE_ROW_KEYS: FeatureKey[] = [
  'projectScheduling',
  'milestones',
  'calendar',
  'gantt',
  'projectTicketing',
  'publicTicketPortal',
  'ticketToTask',
  'ticketCategories',
  'ticketAttachments',
]

const FEATURE_ROWS: Row[] = FEATURE_ROW_KEYS.map((key) => ({
  label: FEATURE_LABELS[key],
  value: (p) => p.features[key],
}))

const REPORT_ROW: Row = {
  label: 'Ticket Reports',
  value: (p) => (p.reportLevel === 'none' ? false : p.reportLevel === 'basic' ? 'Basic' : 'Advanced'),
}

const BUSINESS_ROW_KEYS: FeatureKey[] = ['sla', 'ticketAutomation', 'customTicketForms', 'api']
const BUSINESS_ROWS: Row[] = BUSINESS_ROW_KEYS.map((key) => ({
  label: FEATURE_LABELS[key],
  value: (p) => p.features[key],
}))

const ALL_ROWS = [...LIMIT_ROWS, ...FEATURE_ROWS, REPORT_ROW, ...BUSINESS_ROWS]

function Cell({ value }: { value: CellValue }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-success/10 text-success">
        <Check className="size-3.5" />
      </span>
    ) : (
      <span className="inline-flex size-6 items-center justify-center text-muted-foreground/40">
        <Minus className="size-3.5" />
      </span>
    )
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>
}

export function FeatureComparisonTable() {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-card p-4 text-left font-semibold text-foreground">Feature</th>
            {PLAN_ORDER.map((tier) => (
              <th
                key={tier}
                className={cn(
                  'p-4 text-center font-semibold text-foreground',
                  tier === 'pro' && 'bg-primary/5',
                )}
              >
                {DEFAULT_PLANS[tier].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_ROWS.map((row, i) => (
            <tr key={row.label} className={cn('border-b border-border last:border-0', i % 2 === 1 && 'bg-muted/40')}>
              <td className="sticky left-0 bg-inherit p-4 text-left font-medium text-foreground/90">{row.label}</td>
              {PLAN_ORDER.map((tier) => (
                <td key={tier} className={cn('p-4 text-center', tier === 'pro' && 'bg-primary/5')}>
                  <div className="flex items-center justify-center">
                    <Cell value={row.value(DEFAULT_PLANS[tier])} />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
