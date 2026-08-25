import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/schema'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CustomTicketFormField } from '@/types/domain'

const FIELD_TYPES: CustomTicketFormField['type'][] = ['text', 'textarea', 'select', 'checkbox']

export function TicketFormsTab({ orgId }: { orgId: string }) {
  const forms = useLiveQuery(() => db.customTicketForms.where('orgId').equals(orgId).toArray(), [orgId])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  async function createForm() {
    if (!name.trim()) return
    await db.customTicketForms.add({
      id: crypto.randomUUID(),
      orgId,
      name: name.trim(),
      fields: [{ id: crypto.randomUUID(), label: 'Subject', type: 'text', required: true }],
    })
    setName('')
    setOpen(false)
  }

  async function addField(formId: string) {
    const form = forms?.find((f) => f.id === formId)
    if (!form) return
    await db.customTicketForms.update(formId, {
      fields: [...form.fields, { id: crypto.randomUUID(), label: 'New field', type: 'text', required: false }],
    })
  }

  async function updateField(formId: string, fieldId: string, patch: Partial<CustomTicketFormField>) {
    const form = forms?.find((f) => f.id === formId)
    if (!form) return
    await db.customTicketForms.update(formId, {
      fields: form.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    })
  }

  async function removeField(formId: string, fieldId: string) {
    const form = forms?.find((f) => f.id === formId)
    if (!form) return
    await db.customTicketForms.update(formId, { fields: form.fields.filter((f) => f.id !== fieldId) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New form
        </Button>
      </div>

      {forms && forms.length > 0 ? (
        <div className="flex flex-col gap-4">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardHeader>
                <CardTitle className="text-base">{form.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {form.fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(form.id, field.id, { label: e.target.value })}
                      className="h-8 flex-1"
                    />
                    <Select value={field.type} onValueChange={(v) => updateField(form.id, field.id, { type: v as CustomTicketFormField['type'] })}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant={field.required ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => updateField(form.id, field.id, { required: !field.required })}>
                      {field.required ? 'Required' : 'Optional'}
                    </Badge>
                    <button
                      type="button"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => removeField(form.id, field.id)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => addField(form.id)}>
                  <Plus className="size-3.5" /> Add field
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileText} title="No custom forms" description="Build tailored intake forms for the public ticket portal." />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New custom form</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-name">Form name</Label>
            <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bug Report Form" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createForm} disabled={!name.trim()}>
              Create form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
