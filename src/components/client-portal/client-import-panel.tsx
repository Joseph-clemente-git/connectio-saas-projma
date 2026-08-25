import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Project, TicketPriority } from '@/types/domain'

type ImportRow = { title: string; description: string; priority: TicketPriority; dueDate: string; valid: boolean; error?: string }

const columns = ['Title', 'Description', 'Priority', 'Due date']
const sample = [
  ['Homepage copy update', 'Refresh the headline and CTA copy for the autumn campaign.', 'High', '2026-10-15'],
  ['Add team members', 'Create three new client team member accounts.', 'Medium', '2026-10-22'],
]

function downloadWorkbook(filename: string, rows: string[][]) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Client requests')
  XLSX.writeFile(workbook, filename)
}

export function ClientImportPanel({ project, submitterName, submitterEmail }: { project: Project; submitterName: string; submitterEmail: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [imported, setImported] = useState(false)

  async function chooseFile(file?: File) {
    if (!file) return
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
    const [header, ...data] = raw
    const positions = columns.map((name) => header.findIndex((value) => value.trim().toLowerCase() === name.toLowerCase()))
    const mapped = data.map((dataRow) => {
      const [title = '', description = '', priorityRaw = 'medium', dueDate = ''] = positions.map((position) => position >= 0 ? dataRow[position] ?? '' : '')
      const priority = priorityRaw.toLowerCase() as TicketPriority
      const error = !title ? 'Title is required' : !['low', 'medium', 'high', 'urgent'].includes(priority) ? 'Priority must be Low, Medium, High, or Urgent' : dueDate && Number.isNaN(Date.parse(dueDate)) ? 'Use a valid due date (YYYY-MM-DD)' : undefined
      return { title, description, priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium', dueDate, valid: !error, error }
    })
    setFileName(file.name)
    setRows(mapped)
    setImported(false)
  }

  async function importRows() {
    const valid = rows.filter((row) => row.valid)
    const now = new Date().toISOString()
    await db.tickets.bulkAdd(valid.map((row) => ({
      id: crypto.randomUUID(), orgId: project.orgId, projectId: project.id, subject: row.title,
      description: row.description, priority: row.priority, status: 'open' as const, approval: 'pending' as const,
      submitterName, submitterEmail, source: 'portal' as const,
      approvalNote: row.dueDate ? `Requested due date: ${row.dueDate}` : undefined, createdAt: now, updatedAt: now,
    })))
    setImported(true)
  }

  const errors = rows.filter((row) => !row.valid)
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <Card>
      <CardHeader>
        <CardTitle>Import requests in bulk</CardTitle>
        <CardDescription>Upload an Excel-compatible CSV to turn each row into a request. The team reviews every item before it becomes project work.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => downloadWorkbook('connectio-client-request-template.xlsx', [columns])}>
            <Download className="size-5 text-primary" /><span className="text-left"><span className="block font-semibold">Download template</span><span className="text-xs text-muted-foreground">Blank column structure</span></span>
          </Button>
          <Button variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => downloadWorkbook('connectio-client-request-sample.xlsx', [columns, ...sample])}>
            <FileSpreadsheet className="size-5 text-primary" /><span className="text-left"><span className="block font-semibold">Download sample</span><span className="text-xs text-muted-foreground">Template with example rows</span></span>
          </Button>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <button type="button" onClick={() => input.current?.click()} className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="size-5" /></span>
          <span><span className="block text-sm font-semibold text-foreground">{fileName || 'Choose an Excel file'}</span><span className="mt-1 block text-xs text-muted-foreground">Supports .xlsx, .xls, and CSV. Required: Title.</span></span>
        </button>
        {rows.length > 0 && <>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            <span className="font-semibold">Field mapping detected:</span>{' '}
            {columns.map((column) => <span key={column} className="mr-2 inline-flex text-muted-foreground">{column} <span aria-hidden="true" className="mx-1">→</span> {column}</span>)}
          </div>
          <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-foreground"><strong>{rows.filter((r) => r.valid).length}</strong> of {rows.length} rows ready to import</p>{errors.length > 0 && <p className="flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" /> {errors.length} need attention</p>}</div>
          <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map((column) => <th key={column} className="px-3 py-2.5 font-medium">{column}</th>)}<th className="px-3 py-2.5 font-medium">Validation</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.title}-${index}`} className="border-t border-border"><td className="px-3 py-2.5 font-medium text-foreground">{row.title || '—'}</td><td className="max-w-52 truncate px-3 py-2.5 text-muted-foreground">{row.description || '—'}</td><td className="px-3 py-2.5 capitalize text-muted-foreground">{row.priority}</td><td className="px-3 py-2.5 text-muted-foreground">{row.dueDate || '—'}</td><td className="px-3 py-2.5">{row.valid ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" /> Ready</span> : <span className="text-destructive">{row.error}</span>}</td></tr>)}</tbody></table></div>
          <Button onClick={importRows} disabled={!rows.some((row) => row.valid) || imported}>{imported ? <><CheckCircle2 className="size-4" /> Requests imported</> : `Import ${rows.filter((row) => row.valid).length} request${rows.filter((row) => row.valid).length === 1 ? '' : 's'}`}</Button>
        </>}
      </CardContent>
    </Card>
    <Card className="h-fit"><CardHeader><CardTitle className="text-base">How import works</CardTitle></CardHeader><CardContent><ol className="space-y-4 text-sm text-muted-foreground">{['Download the template or sample.', 'Fill one request per row in Excel.', 'Upload and confirm field mapping.', 'Fix any validation issues.', 'Preview and import requests for review.'].map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><span>{step}</span></li>)}</ol></CardContent></Card>
  </div>
}
