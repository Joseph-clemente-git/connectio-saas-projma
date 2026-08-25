import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/schema'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { FeatureGate } from '@/components/shared/feature-lock'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

function mask(key: string) {
  return `${key.slice(0, 7)}${'•'.repeat(18)}${key.slice(-4)}`
}

export function SettingsApiPage() {
  const { org, plan } = useOutletContext<TenantOutletContext>()
  const keys = useLiveQuery(() => db.apiKeys.where('orgId').equals(org.id).toArray(), [org.id])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  async function createKey() {
    await db.apiKeys.add({
      id: crypto.randomUUID(),
      orgId: org.id,
      name: `Key ${(keys?.length ?? 0) + 1}`,
      key: `sk_live_${crypto.randomUUID().replace(/-/g, '')}`,
      createdAt: new Date().toISOString(),
      revoked: false,
    })
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="API" description="Generate keys to integrate Connectio with your own tools." />
      <FeatureGate plan={plan} feature="api" label="API">
        <div className="flex flex-col gap-6 p-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>API keys</CardTitle>
                <CardDescription>Keep these secret — anyone with a key can access this organization's data.</CardDescription>
              </div>
              <Button size="sm" onClick={createKey}>
                <Plus className="size-4" /> Generate key
              </Button>
            </CardHeader>
            <CardContent>
              {keys && keys.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <KeyRound className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{k.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {revealed.has(k.id) ? k.key : mask(k.key)}
                          </p>
                          <p className="text-xs text-muted-foreground">Created {format(new Date(k.createdAt), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => toggleReveal(k.id)}
                          aria-label={revealed.has(k.id) ? 'Hide key' : 'Reveal key'}
                        >
                          {revealed.has(k.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigator.clipboard?.writeText(k.key)}
                          aria-label="Copy key"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => db.apiKeys.delete(k.id)}
                          aria-label="Delete key"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={KeyRound} title="No API keys" description="Generate a key to start calling the Connectio API." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick start</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-foreground p-4 text-xs text-background">
                {`curl https://api.connectio.app/v1/tickets \\\n  -H "Authorization: Bearer ${keys?.[0]?.key ?? 'sk_live_...'}"`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </div>
  )
}
