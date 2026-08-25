import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, FileUp, Info, Upload, XCircle } from 'lucide-react'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useOrgMembersWithUsers } from '@/hooks/use-session-data'
import type { Project, Task, TaskPriority } from '@/types/domain'
import { workflowStages } from '@/lib/project-workflow'

const fields = [
  ['id', 'Task ID'], ['title', 'Title'], ['description', 'Description'], ['status', 'Status'],
  ['assignee', 'Assignee'], ['priority', 'Priority'], ['startDate', 'Start date'], ['dueDate', 'Due date'],
  ['sprint', 'Sprint'], ['milestone', 'Milestone'], ['completion', 'Completion'], ['labels', 'Labels'],
] as const
type Field = (typeof fields)[number][0]
type Row = Record<string, unknown>
type PreparedRow = { row: Row; values: Partial<Record<Field, string>>; errors: string[] }

const sample = [{
  'Task ID': 'TASK-001', Title: 'Plan onboarding workshop', Description: 'Confirm agenda and participants.', Status: 'backlog', Assignee: '', Priority: 'medium',
  'Start date': '2026-09-01', 'Due date': '2026-09-05', Sprint: 'Sprint 1', Milestone: 'Launch', Completion: '0', Labels: 'onboarding, planning',
}]

function saveWorkbook(rows: Row[], fileName: string, type: 'csv' | 'xlsx') {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Tasks')
  XLSX.writeFile(book, `${fileName}.${type}`, { bookType: type })
}

function dateValue(raw: string | undefined) {
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function TaskImportExportPanel({ project, orgId, currentUserId, canManage }: { project: Project; orgId: string; currentUserId: string; canManage: boolean }) {
  const stages = workflowStages(project)
  const initialStageId = stages[0]?.id ?? 'backlog'
  const finalStageId = stages.at(-1)?.id ?? 'done'
  const inputRef = useRef<HTMLInputElement>(null)
  const tasks = useLiveQuery(() => db.tasks.where('projectId').equals(project.id).sortBy('order'), [project.id])
  const sprints = useLiveQuery(() => db.sprints.where('projectId').equals(project.id).toArray(), [project.id])
  const milestones = useLiveQuery(() => db.milestones.where('projectId').equals(project.id).toArray(), [project.id])
  const members = useOrgMembersWithUsers(orgId)
  const [sourceRows, setSourceRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Partial<Record<Field, string>>>({})
  const [fileName, setFileName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const prepared: PreparedRow[] = sourceRows.map((row) => {
    const values = Object.fromEntries(fields.map(([key]) => [key, String(row[mapping[key] ?? ''] ?? '').trim()])) as Partial<Record<Field, string>>
    const errors: string[] = []
    if (!values.title) errors.push('Title is required')
    if (values.priority && !['low', 'medium', 'high', 'urgent'].includes(values.priority.toLowerCase())) errors.push('Priority must be low, medium, high, or urgent')
    if (values.completion && (!Number.isFinite(Number(values.completion)) || Number(values.completion) < 0 || Number(values.completion) > 100)) errors.push('Completion must be 0–100')
    if (values.startDate && !dateValue(values.startDate)) errors.push('Start date is invalid')
    if (values.dueDate && !dateValue(values.dueDate)) errors.push('Due date is invalid')
    if (values.status && !stages.some((stage) => stage.id === values.status)) errors.push('Status is not in this project workflow')
    return { row, values, errors }
  })
  const validRows = prepared.filter((item) => item.errors.length === 0)

  function setRows(rows: Row[], name: string) {
    const nextHeaders = rows[0] ? Object.keys(rows[0]) : []
    setSourceRows(rows)
    setHeaders(nextHeaders)
    setFileName(name)
    const normalized = new Map(nextHeaders.map((header) => [header.toLowerCase().replace(/[^a-z]/g, ''), header]))
    setMapping(Object.fromEntries(fields.map(([key, label]) => [key, normalized.get(key.toLowerCase()) ?? normalized.get(label.toLowerCase().replace(/[^a-z]/g, '')) ?? ''])))
    setNotice(rows.length ? null : 'The selected file has no task rows.')
  }

  async function handleFile(file?: File) {
    if (!file) return
    const suffix = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(suffix ?? '')) { setNotice('Choose a CSV, XLSX, or XLS file.'); return }
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      setRows(XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' }), file.name)
    } catch { setNotice('We could not read that file. Download the template and try again.') }
  }

  async function importTasks() {
    if (!validRows.length) return
    const now = new Date().toISOString()
    const startOrder = tasks?.length ?? 0
    await db.transaction('rw', db.tasks, db.auditLogs, async () => {
      await db.tasks.bulkAdd(validRows.map(({ values }, index): Task => {
        const assignee = members?.find((entry) => [entry.user.id, entry.user.name, entry.user.email].some((value) => value.toLowerCase() === values.assignee?.toLowerCase()))?.user
        const sprint = sprints?.find((item) => [item.id, item.name].some((value) => value.toLowerCase() === values.sprint?.toLowerCase()))
        const milestone = milestones?.find((item) => [item.id, item.name].some((value) => value.toLowerCase() === values.milestone?.toLowerCase()))
        return { id: values.id || crypto.randomUUID(), projectId: project.id, title: values.title!, description: values.description || undefined, status: values.status || initialStageId, priority: (values.priority?.toLowerCase() as TaskPriority) || 'medium', assigneeId: assignee?.id, sprintId: sprint?.id, milestoneId: sprint?.milestoneId ? undefined : milestone?.id, startDate: dateValue(values.startDate), dueDate: dateValue(values.dueDate), completion: values.completion ? Number(values.completion) : undefined, labels: values.labels ? values.labels.split(',').map((label) => label.trim()).filter(Boolean) : undefined, createdById: currentUserId, order: startOrder + index, createdAt: now }
      }))
      await db.auditLogs.add({ id: crypto.randomUUID(), orgId, actorName: members?.find((entry) => entry.user.id === currentUserId)?.user.name ?? 'Unknown member', action: `imported ${validRows.length} task${validRows.length === 1 ? '' : 's'} from ${fileName}`, target: project.name, createdAt: now })
    })
    setNotice(`Imported ${validRows.length} task${validRows.length === 1 ? '' : 's'}.`)
    setSourceRows([]); setHeaders([]); setFileName('')
  }

  function exportTasks(type: 'csv' | 'xlsx') {
    const rows = (tasks ?? []).map((task) => ({
      'Task ID': task.id, Title: task.title, Description: task.description ?? '', Status: task.status,
      Assignee: members?.find((entry) => entry.user.id === task.assigneeId)?.user.name ?? '', Priority: task.priority,
      'Start date': task.startDate?.slice(0, 10) ?? '', 'Due date': task.dueDate?.slice(0, 10) ?? '', Sprint: sprints?.find((item) => item.id === task.sprintId)?.name ?? '', Milestone: milestones?.find((item) => item.id === (sprints?.find((sprint) => sprint.id === task.sprintId)?.milestoneId ?? task.milestoneId))?.name ?? '', Completion: task.completion ?? (task.status === finalStageId ? 100 : 0), Labels: task.labels?.join(', ') ?? '',
    }))
    saveWorkbook(rows, `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tasks`, type)
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
    <div><h2 className="text-lg font-semibold text-foreground">Task import & export</h2><p className="mt-1 text-sm text-muted-foreground">Move task plans in or out without losing the fields your delivery workflow needs.</p></div>
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><XCircle className="size-4 text-muted-foreground" /></button></div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-4 text-primary" />Import tasks</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Upload CSV or Excel, map its columns, validate every row, then review the preview before adding tasks.</p>
        <input ref={inputRef} className="sr-only" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => handleFile(event.target.files?.[0])} />
        <div className="flex flex-wrap gap-2"><Button onClick={() => inputRef.current?.click()} disabled={!canManage}><Upload />Choose file</Button><Button variant="outline" onClick={() => saveWorkbook(sample, 'connectio-task-template', 'xlsx')}><Download />Excel template</Button><Button variant="outline" onClick={() => saveWorkbook(sample, 'connectio-task-sample', 'csv')}><Download />Sample CSV</Button></div>
        {!canManage && <p className="text-xs text-muted-foreground">Only project managers can import tasks.</p>}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground"><Info className="mr-1 inline size-3.5" />Title is required. Assignee, sprint, and milestone can be matched by either name or ID.</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="size-4 text-primary" />Export tasks</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Export all {tasks?.length ?? 0} project tasks with IDs, people, workflow, dates, planning links, completion, and labels.</p><div className="flex flex-wrap gap-2"><Button onClick={() => exportTasks('xlsx')}><Download />Export Excel</Button><Button variant="outline" onClick={() => exportTasks('csv')}><Download />Export CSV</Button></div></CardContent></Card>
    </div>
    {sourceRows.length > 0 && <Card><CardHeader><CardTitle className="text-base">Map and review {fileName}</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label]) => <div key={key} className="space-y-1"><Label htmlFor={`map-${key}`} className="text-xs">{label}{key === 'title' && ' *'}</Label><select id={`map-${key}`} value={mapping[key] ?? ''} onChange={(event) => setMapping((value) => ({ ...value, [key]: event.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"><option value="">Do not import</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></div>)}</div>
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><strong className="text-foreground">{validRows.length}</strong> valid of {prepared.length} rows. {prepared.length - validRows.length > 0 && <span className="text-destructive">Fix invalid rows before importing.</span>}</p><Button onClick={importTasks} disabled={!canManage || validRows.length !== prepared.length || !validRows.length}>Import {validRows.length} task{validRows.length === 1 ? '' : 's'}</Button></div>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">Row</th><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Assignee</th><th className="p-3">Due date</th><th className="p-3">Validation</th></tr></thead><tbody>{prepared.slice(0, 10).map((item, index) => <tr key={index} className="border-t border-border"><td className="p-3">{index + 2}</td><td className="p-3 font-medium text-foreground">{item.values.title || '—'}</td><td className="p-3">{item.values.status || 'backlog'}</td><td className="p-3">{item.values.assignee || '—'}</td><td className="p-3">{item.values.dueDate || '—'}</td><td className="p-3">{item.errors.length ? <span className="text-destructive">{item.errors.join('; ')}</span> : <span className="text-success">Ready</span>}</td></tr>)}</tbody></table></div>{prepared.length > 10 && <p className="text-xs text-muted-foreground">Showing the first 10 rows; all {prepared.length} rows are validated before import.</p>}
    </CardContent></Card>}
  </div>
}
