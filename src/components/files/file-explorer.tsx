import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Download, Eye, File, FileImage, FileText, Folder, FolderPlus, HardDrive, MoreHorizontal, MoveRight, Pencil, Search, Shield, Trash2, Upload, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '@/db/schema'
import type { FileEntry, ID } from '@/types/domain'
import type { PlanConfig } from '@/lib/plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type ExplorerScope = { orgId: ID; userId: ID; plan: PlanConfig; workspaceId?: ID; projectId?: ID; title?: string; canManage?: boolean }
const ROOT_FOLDERS = ['Documents', 'Images', 'Project Files', 'Templates']
const GB = 1024 * 1024 * 1024

function bytes(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

function iconFor(entry: FileEntry) {
  if (entry.kind === 'folder') return <Folder className="size-5 fill-amber-400/25 text-amber-600" aria-hidden="true" />
  if (entry.mimeType?.startsWith('image/')) return <FileImage className="size-5 text-violet-600" aria-hidden="true" />
  if (entry.mimeType?.includes('pdf') || entry.mimeType?.includes('text') || entry.mimeType?.includes('document')) return <FileText className="size-5 text-primary" aria-hidden="true" />
  return <File className="size-5 text-muted-foreground" aria-hidden="true" />
}

export function FileExplorer({ orgId, userId, plan, workspaceId, projectId, title, canManage = true }: ExplorerScope) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentId, setCurrentId] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<'folder' | 'rename' | 'move' | 'permissions' | 'delete' | 'preview' | null>(null)
  const [active, setActive] = useState<FileEntry | null>(null)
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('root')

  const entries = useLiveQuery(async () => {
    let all = await db.files.where('orgId').equals(orgId).toArray()
    if (projectId) all = all.filter((entry) => entry.projectId === projectId)
    else if (workspaceId) all = all.filter((entry) => entry.workspaceId === workspaceId && !entry.projectId)
    else all = all.filter((entry) => !entry.workspaceId && !entry.projectId)
    return all
  }, [orgId, workspaceId, projectId])

  useEffect(() => {
    if (!workspaceId || projectId) return
    db.files.where('workspaceId').equals(workspaceId).count().then((count) => {
      if (count) return
      const now = new Date().toISOString()
      return db.files.bulkAdd(ROOT_FOLDERS.map((folder) => ({ id: crypto.randomUUID(), orgId, workspaceId, kind: 'folder' as const, name: folder, size: 0, permission: 'workspace' as const, version: 1, createdAt: now, updatedAt: now, updatedById: userId })))
    })
  }, [orgId, projectId, userId, workspaceId])

  const items = entries ?? []
  const lookup = new Map(items.map((entry) => [entry.id, entry]))
  const ancestors = useMemo(() => {
    const path: FileEntry[] = []
    let cursor = currentId ? lookup.get(currentId) : undefined
    while (cursor) { path.unshift(cursor); cursor = cursor.parentId ? lookup.get(cursor.parentId) : undefined }
    return path
  }, [currentId, items.length])
  const isSearch = Boolean(query.trim())
  const visible = useMemo(() => (isSearch
    ? items.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()))
    : items.filter((entry) => entry.parentId === currentId))
    .sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name)), [items, currentId, isSearch, query])
  const orgUsage = useLiveQuery(async () => (await db.files.where('orgId').equals(orgId).toArray()).filter((entry) => entry.kind === 'file').reduce((sum, entry) => sum + entry.size, 0), [orgId])
  const used = orgUsage ?? 0
  const scopeUsed = items.filter((entry) => entry.kind === 'file').reduce((sum, entry) => sum + entry.size, 0)
  const limit = plan.limits.storageGb * GB
  const percentage = Math.min(100, Math.round((used / limit) * 100))

  function openDialog(kind: 'folder' | 'rename' | 'move' | 'permissions' | 'delete' | 'preview', entry?: FileEntry) {
    if (!canManage && kind !== 'preview') return
    setActive(entry ?? null); setName(entry?.name ?? ''); setDestination(entry?.parentId ?? 'root'); setDialog(kind)
  }
  async function createFolder() {
    if (!canManage || !name.trim()) return
    const now = new Date().toISOString()
    await db.files.add({ id: crypto.randomUUID(), orgId, workspaceId, projectId, parentId: currentId, kind: 'folder', name: name.trim(), size: 0, permission: projectId ? 'project' : 'workspace', version: 1, createdAt: now, updatedAt: now, updatedById: userId })
    setDialog(null)
  }
  async function rename() { if (canManage && active && name.trim()) { await db.files.update(active.id, { name: name.trim(), version: active.version + 1, updatedAt: new Date().toISOString(), updatedById: userId }); setDialog(null) } }
  async function move() { if (canManage && active) { await db.files.update(active.id, { parentId: destination === 'root' ? undefined : destination, updatedAt: new Date().toISOString(), updatedById: userId }); setDialog(null) } }
  async function remove() {
    if (!canManage || !active) return
    const ids = new Set<string>([active.id]); let changed = true
    while (changed) { changed = false; items.forEach((entry) => { if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) { ids.add(entry.id); changed = true } }) }
    await db.files.bulkDelete([...ids]); if (currentId && ids.has(currentId)) setCurrentId(undefined); setDialog(null)
  }
  async function upload(files: FileList | null) {
    if (!canManage || !files?.length) return
    const selected = [...files]
    const total = selected.reduce((sum, file) => sum + file.size, 0)
    if (used + total > limit) { window.alert(`This upload exceeds your ${plan.limits.storageGb} GB ${plan.name} storage capacity.`); return }
    const now = new Date().toISOString()
    await Promise.all(selected.map((file) => {
      const existing = items.find((entry) => entry.kind === 'file' && entry.parentId === currentId && entry.name === file.name)
      return existing
        ? db.files.update(existing.id, { size: file.size, blob: file, mimeType: file.type || 'application/octet-stream', version: existing.version + 1, updatedAt: now, updatedById: userId })
        : db.files.add({ id: crypto.randomUUID(), orgId, workspaceId, projectId, parentId: currentId, kind: 'file' as const, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, blob: file, permission: projectId ? 'project' as const : 'workspace' as const, version: 1, createdAt: now, updatedAt: now, updatedById: userId })
    }))
    if (inputRef.current) inputRef.current.value = ''
  }
  function download(entry: FileEntry) { if (!entry.blob) return; const url = URL.createObjectURL(entry.blob); const a = document.createElement('a'); a.href = url; a.download = entry.name; a.click(); URL.revokeObjectURL(url) }
  const moveTargets = items.filter((entry) => entry.kind === 'folder' && entry.id !== active?.id && !isDescendant(entry, active, lookup))

  return <div className="flex min-h-0 flex-1 flex-col bg-background">
    <div className="flex flex-col gap-4 border-b border-border bg-card px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0"><h2 className="text-lg font-bold text-foreground">{title ?? 'File Explorer'}</h2><div className="mt-1 flex items-center gap-1 overflow-x-auto text-xs text-muted-foreground"><button className="cursor-pointer hover:text-primary" onClick={() => setCurrentId(undefined)}>Home</button>{ancestors.map((entry) => <span className="flex items-center gap-1" key={entry.id}><ChevronRight className="size-3" /><button className="cursor-pointer whitespace-nowrap hover:text-primary" onClick={() => setCurrentId(entry.id)}>{entry.name}</button></span>)}</div></div>
      {canManage && <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => openDialog('folder')}><FolderPlus /> New folder</Button><Button size="sm" onClick={() => inputRef.current?.click()}><Upload /> Upload</Button><input ref={inputRef} className="sr-only" type="file" multiple onChange={(event) => upload(event.target.files)} /></div>}
    </div>
    <div className="grid gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)] lg:items-stretch">
      <div className="flex h-11 min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 text-muted-foreground shadow-xs transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
        <label className="sr-only" htmlFor="file-space-search">Search this file space</label>
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <Input id="file-space-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this file space" className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0" />
        {query && <button type="button" aria-label="Clear search" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground" onClick={() => setQuery('')}><X className="size-4" /></button>}
      </div>
      <section className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs" aria-label="Storage usage">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><HardDrive className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-foreground">Storage</span>
              <span className="shrink-0 text-xs text-muted-foreground">{plan.limits.storageGb} GB capacity</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{bytes(used)} used</p>
            <p className="mt-1 text-xs text-muted-foreground">This space: {bytes(scopeUsed)} <span aria-hidden="true">·</span> {bytes(Math.max(0, limit - used))} remaining</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Organization storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
              <div className={cn('h-full rounded-full transition-[width]', percentage > 90 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        </div>
      </section>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-6">
      {isSearch && <p className="mb-3 text-sm text-muted-foreground">{visible.length} result{visible.length === 1 ? '' : 's'} across this file space</p>}
      <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="hidden grid-cols-[minmax(240px,1fr)_110px_150px_130px_44px] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground md:grid"><span>Name</span><span>Size</span><span>Modified</span><span>Access</span><span /></div>
        {visible.map((entry) => <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(240px,1fr)_110px_150px_130px_44px]">
          <button className="flex min-w-0 cursor-pointer items-center gap-3 text-left" onClick={() => entry.kind === 'folder' ? (setCurrentId(entry.id), setQuery('')) : openDialog('preview', entry)}>{iconFor(entry)}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{entry.name}</span><span className="block text-xs text-muted-foreground md:hidden">{entry.kind === 'folder' ? 'Folder' : bytes(entry.size)} · v{entry.version}</span></span></button>
          <span className="hidden text-sm text-muted-foreground md:block">{entry.kind === 'folder' ? '—' : bytes(entry.size)}</span><span className="hidden text-xs text-muted-foreground md:block">{format(new Date(entry.updatedAt), 'MMM d, yyyy')}</span><span className="hidden md:block"><Badge variant="secondary" className="capitalize"><Shield className="size-3" /> {entry.permission}</Badge></span>
          <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${entry.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => entry.kind === 'file' && openDialog('preview', entry)}><Eye /> Preview</DropdownMenuItem>{entry.kind === 'file' && <DropdownMenuItem onSelect={() => download(entry)}><Download /> Download</DropdownMenuItem>}{canManage && <><DropdownMenuItem onSelect={() => openDialog('rename', entry)}><Pencil /> Rename</DropdownMenuItem><DropdownMenuItem onSelect={() => openDialog('move', entry)}><MoveRight /> Move</DropdownMenuItem><DropdownMenuItem onSelect={() => openDialog('permissions', entry)}><Shield /> Permissions</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => openDialog('delete', entry)}><Trash2 /> Delete</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
        </div>)}
        {!visible.length && <div className="px-6 py-14 text-center"><Folder className="mx-auto size-9 text-muted-foreground/50" /><p className="mt-3 font-semibold">{isSearch ? 'No matching files' : 'This folder is empty'}</p><p className="mt-1 text-sm text-muted-foreground">{isSearch ? 'Try a different name or clear the search.' : 'Create a folder or upload files to get started.'}</p></div>}
      </div>
    </div>
    <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className={dialog === 'preview' ? 'max-w-3xl' : undefined}>
      {dialog === 'folder' && <><DialogHeader><DialogTitle>New folder</DialogTitle><DialogDescription>Create it in the current location.</DialogDescription></DialogHeader><Label htmlFor="folder-name">Folder name</Label><Input id="folder-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFolder()} /><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={createFolder} disabled={!name.trim()}>Create folder</Button></DialogFooter></>}
      {dialog === 'rename' && active && <><DialogHeader><DialogTitle>Rename {active.kind}</DialogTitle><DialogDescription>Renaming creates a new version in the activity history.</DialogDescription></DialogHeader><Label htmlFor="rename-name">Name</Label><Input id="rename-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} /><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={rename} disabled={!name.trim()}>Rename</Button></DialogFooter></>}
      {dialog === 'move' && active && <><DialogHeader><DialogTitle>Move {active.name}</DialogTitle><DialogDescription>Select a destination folder in this scope.</DialogDescription></DialogHeader><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">Home</SelectItem>{moveTargets.map((folder) => <SelectItem value={folder.id} key={folder.id}>{folder.name}</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={move}>Move</Button></DialogFooter></>}
      {dialog === 'permissions' && active && <><DialogHeader><DialogTitle>Permissions for {active.name}</DialogTitle><DialogDescription>Choose who can access this item within your organization.</DialogDescription></DialogHeader><Select value={active.permission} onValueChange={(permission) => setActive({ ...active, permission: permission as FileEntry['permission'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="workspace">Workspace members</SelectItem><SelectItem value="project">Project members</SelectItem><SelectItem value="private">Only me</SelectItem></SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={async () => { await db.files.update(active.id, { permission: active.permission, updatedAt: new Date().toISOString(), updatedById: userId }); setDialog(null) }}>Save permissions</Button></DialogFooter></>}
      {dialog === 'delete' && active && <><DialogHeader><DialogTitle>Delete {active.name}?</DialogTitle><DialogDescription>{active.kind === 'folder' ? 'Its contents will also be permanently deleted.' : 'This file will be permanently deleted.'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button variant="destructive" onClick={remove}>Delete</Button></DialogFooter></>}
      {dialog === 'preview' && active && <Preview entry={active} onDownload={() => download(active)} />}
    </DialogContent></Dialog>
  </div>
}

function isDescendant(candidate: FileEntry, active: FileEntry | null, lookup: Map<string, FileEntry>) { let cursor = candidate; while (cursor.parentId) { if (cursor.parentId === active?.id) return true; const parent = lookup.get(cursor.parentId); if (!parent) break; cursor = parent } return false }
function Preview({ entry, onDownload }: { entry: FileEntry; onDownload: () => void }) { const url = useMemo(() => entry.blob ? URL.createObjectURL(entry.blob) : undefined, [entry.blob]); useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url]); return <><DialogHeader><DialogTitle>{entry.name}</DialogTitle><DialogDescription>{bytes(entry.size)} · {entry.mimeType ?? 'Unknown file type'} · Version {entry.version}</DialogDescription></DialogHeader><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">{entry.mimeType?.startsWith('image/') && url ? <img src={url} alt={entry.name} className="max-h-[55vh] max-w-full object-contain" /> : entry.mimeType === 'application/pdf' && url ? <iframe src={url} title={entry.name} className="h-[55vh] w-full" /> : <div className="text-center text-sm text-muted-foreground"><File className="mx-auto mb-3 size-10" />Preview is not available for this file type.</div>}</div><div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Access</span><span className="capitalize">{entry.permission}</span><span className="text-muted-foreground">Last modified</span><span>{format(new Date(entry.updatedAt), 'MMM d, yyyy, p')}</span></div><DialogFooter><Button onClick={onDownload}><Download /> Download</Button></DialogFooter></> }
