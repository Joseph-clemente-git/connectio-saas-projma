import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { db } from '@/db/schema'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#CA8A04']

export function TicketCategoriesTab({ orgId }: { orgId: string }) {
  const categories = useLiveQuery(() => db.ticketCategories.where('orgId').equals(orgId).toArray(), [orgId])
  const [name, setName] = useState('')

  async function add() {
    if (!name.trim()) return
    await db.ticketCategories.add({
      id: crypto.randomUUID(),
      orgId,
      name: name.trim(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New category name"
        />
        <Button onClick={add} disabled={!name.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {categories && categories.length > 0 ? (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
              <button
                type="button"
                className="cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={() => db.ticketCategories.delete(c.id)}
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Tag} title="No categories yet" description="Add categories to organize incoming tickets." />
      )}
    </div>
  )
}
