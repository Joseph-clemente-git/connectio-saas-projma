import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, Link2, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@/types/domain'

interface LinksManagerProps {
  orgId: string
  currentUser: User
  workspaceId?: string
  projectId?: string
}

export function LinksManager({ orgId, currentUser, workspaceId, projectId }: LinksManagerProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const links = useLiveQuery(
    () => workspaceId
      ? db.links.where('workspaceId').equals(workspaceId).reverse().sortBy('createdAt')
      : projectId ? db.links.where('projectId').equals(projectId).reverse().sortBy('createdAt') : [],
    [workspaceId, projectId],
  )
  const contributorIds = links?.map((link) => link.addedById) ?? []
  const contributors = useLiveQuery(
    () => contributorIds.length ? db.users.bulkGet(contributorIds) : [],
    [contributorIds.join(',')],
  )
  const contributorNames = new Map(contributors?.filter(Boolean).map((user) => [user!.id, user!.name]))
  const scope = workspaceId ? 'workspace' : 'project'

  function resetForm() {
    setTitle('')
    setUrl('')
    setDescription('')
    setCategory('')
    setError('')
  }

  async function createLink() {
    let normalizedUrl: string
    try {
      normalizedUrl = new URL(url.trim()).toString()
    } catch {
      setError('Enter a complete URL, including https://.')
      return
    }
    await db.links.add({
      id: crypto.randomUUID(),
      orgId,
      ...(workspaceId ? { workspaceId } : { projectId }),
      title: title.trim(),
      url: normalizedUrl,
      description: description.trim(),
      category: category.trim() || 'General',
      addedById: currentUser.id,
      createdAt: new Date().toISOString(),
    })
    setOpen(false)
    resetForm()
  }

  return (
    <section aria-labelledby={`${scope}-links-heading`} className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${scope}-links-heading`} className="flex items-center gap-2 text-lg font-semibold text-foreground"><Link2 className="size-5 text-primary" /> Links</h2>
          <p className="mt-1 text-sm text-muted-foreground">Shared resources with context, so members know what each link is for before opening it.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus /> Add link</Button>
      </div>

      {links && links.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {links.map((link) => (
            <Card key={link.id} className="transition-shadow duration-200 hover:shadow-md">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="break-words text-base">{link.title}</CardTitle>
                  <a className="mt-1 flex w-fit max-w-full items-center gap-1 text-sm text-primary hover:underline" href={link.url} target="_blank" rel="noreferrer">
                    <span className="truncate">{link.url}</span><ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                  </a>
                </div>
                <Badge variant="secondary" className="shrink-0">{link.category}</Badge>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{link.description}</p>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Added by <span className="font-medium text-foreground">{contributorNames.get(link.addedById) ?? 'Unknown member'}</span> · {format(new Date(link.createdAt), 'MMM d, yyyy')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Link2 className="size-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold text-foreground">No links yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Add design files, documents, or other resources and explain their purpose for the team.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}><Plus /> Add the first link</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) resetForm() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add {scope} link</DialogTitle>
            <DialogDescription>Give the resource enough context that teammates can decide whether to open it.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor={`${scope}-link-title`}>Link title</Label><Input id={`${scope}-link-title`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Figma Design" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`${scope}-link-url`}>URL</Label><Input id={`${scope}-link-url`} type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /><p className="text-xs text-muted-foreground">Include https:// so the link opens reliably.</p></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`${scope}-link-description`}>Description</Label><textarea id={`${scope}-link-description`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Final approved design for the customer portal." rows={3} className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" /><p className="text-xs text-muted-foreground">Explain what this resource is for and when to use it.</p></div>
            <div className="flex flex-col gap-2"><Label htmlFor={`${scope}-link-category`}>Link type / category</Label><Input id={`${scope}-link-category`} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Design, documentation, brief…" /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={createLink} disabled={!title.trim() || !url.trim() || !description.trim()}>Add link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
