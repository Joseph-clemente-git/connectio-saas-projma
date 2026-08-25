import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { WorkflowStage } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WorkflowSetEditor({
  stages,
  onChange,
}: {
  stages: WorkflowStage[]
  onChange: (stages: WorkflowStage[]) => void
}) {
  const patch = (id: string, fields: Partial<WorkflowStage>) =>
    onChange(stages.map((stage) => (stage.id === id ? { ...stage, ...fields } : stage)))
  const move = (index: number, delta: -1 | 1) => {
    const next = [...stages]
    const to = index + delta
    if (next[to]) [next[index], next[to]] = [next[to], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Workflow stages</p>
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
            {index + 1}
          </span>
          <Input
            value={stage.name}
            aria-label={`Stage ${index + 1} name`}
            onChange={(event) => patch(stage.id, { name: event.target.value })}
            className="min-w-48 flex-1"
          />
          <div className="ml-12 flex sm:ml-0">
            <Button type="button" size="icon" variant="ghost" aria-label={`Move ${stage.name} up`} disabled={!index} onClick={() => move(index, -1)}>
              <ChevronUp aria-hidden="true" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label={`Move ${stage.name} down`} disabled={index === stages.length - 1} onClick={() => move(index, 1)}>
              <ChevronDown aria-hidden="true" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${stage.name}`} disabled={stages.length === 1} onClick={() => onChange(stages.filter((item) => item.id !== stage.id))}>
              <Trash2 aria-hidden="true" className="text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...stages, { id: `stage-${crypto.randomUUID()}`, name: 'New stage' }])}
      >
        <Plus aria-hidden="true" /> Add stage
      </Button>
    </div>
  )
}
