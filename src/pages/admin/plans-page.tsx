import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PLAN_ORDER, FEATURE_GROUPS, FEATURE_LABELS, type FeatureKey, type PlanConfig, type ReportLevel } from '@/lib/plans'
import type { PlanLimits } from '@/lib/plans'
import { LoadingScreen } from '@/components/shared/loading-screen'

const LIMIT_FIELDS: { key: keyof PlanLimits; label: string }[] = [
  { key: 'teams', label: 'Teams' },
  { key: 'members', label: 'Members' },
  { key: 'workspaces', label: 'Workspaces' },
  { key: 'projects', label: 'Projects' },
]

function PlanCard({ plan }: { plan: PlanConfig }) {
  function patch(fields: Partial<PlanConfig>) {
    db.planConfigs.update(plan.id, fields)
  }
  function patchLimit(key: keyof PlanLimits, value: number | null) {
    patch({ limits: { ...plan.limits, [key]: value } })
  }
  function patchFeature(key: FeatureKey, value: boolean) {
    patch({ features: { ...plan.features, [key]: value } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {plan.name}
          <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            $
            <Input
              type="number"
              min={0}
              value={plan.monthlyPrice ?? 0}
              onChange={(e) => patch({ monthlyPrice: Number(e.target.value) || 0 })}
              className="h-8 w-20"
            />
            /mo
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limits</p>
          <div className="grid grid-cols-2 gap-3">
            {LIMIT_FIELDS.map((f) => {
              const value = plan.limits[f.key]
              const unlimited = value === null
              return (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      disabled={unlimited}
                      value={unlimited ? '' : value}
                      placeholder={unlimited ? 'Unlimited' : undefined}
                      onChange={(e) => patchLimit(f.key, Number(e.target.value) || 1)}
                      className="h-8"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={unlimited}
                      onCheckedChange={(checked) => patchLimit(f.key, checked ? null : 5)}
                      className="size-3.5"
                    />
                    Unlimited
                  </label>
                </div>
              )
            })}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Storage (GB)</Label>
              <Input
                type="number"
                min={1}
                value={plan.limits.storageGb}
                onChange={(e) => patch({ limits: { ...plan.limits, storageGb: Number(e.target.value) || 1 } })}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">Organization capacity</span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket reports</p>
          <Select value={plan.reportLevel} onValueChange={(v) => patch({ reportLevel: v as ReportLevel })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Features</p>
          <div className="flex flex-col gap-4">
            {FEATURE_GROUPS.map((group) => (
              <section key={group.label} aria-labelledby={`${plan.id}-${group.label.replaceAll(' ', '-').toLowerCase()}`}>
                <h3 id={`${plan.id}-${group.label.replaceAll(' ', '-').toLowerCase()}`} className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  {group.features.map((key) => (
                    <div key={key} className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0">
                      <span className="text-sm text-foreground">{FEATURE_LABELS[key]}</span>
                      <Switch aria-label={`${FEATURE_LABELS[key]} for ${plan.name}`} checked={plan.features[key]} onCheckedChange={(v) => patchFeature(key, v)} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PlansPage() {
  const plans = useLiveQuery(() => db.planConfigs.toArray(), [])

  if (!plans) return <LoadingScreen />

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Plan management" description="Edit limits, features, and pricing live — changes apply to every org on that plan immediately." />
      <div className="grid gap-6 p-6 md:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const plan = plans.find((p) => p.id === tier)
          return plan ? <PlanCard key={tier} plan={plan} /> : null
        })}
      </div>
    </div>
  )
}
