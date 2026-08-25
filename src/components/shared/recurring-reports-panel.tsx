import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, Mail, Plus, Send, Trash2 } from 'lucide-react'
import { db } from '@/db/schema'
import type { RecurringReport, RecurringReportType, ReportFrequency } from '@/types/domain'
import { REPORT_TYPE_LABELS, WEEKDAYS, describeSchedule, nextReportRun } from '@/lib/recurring-reports'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

type Props = { orgId: string; scope: 'workspace' | 'project'; workspaceId?: string; projectId?: string; canManage: boolean }

export function RecurringReportsPanel({ orgId, scope, workspaceId, projectId, canManage }: Props) {
  const reports = useLiveQuery(() => db.recurringReports.where('orgId').equals(orgId).filter((r) => r.scope === scope && r.workspaceId === workspaceId && r.projectId === projectId).toArray(), [orgId, scope, workspaceId, projectId])
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<RecurringReportType>('project_status')
  const [emails, setEmails] = useState('manager@company.com\nclient@company.com\nowner@company.com')
  const [frequency, setFrequency] = useState<ReportFrequency>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [intervalDays, setIntervalDays] = useState('15')
  const [time, setTime] = useState('08:00')

  async function create() {
    if (!canManage) return
    const recipientEmails = emails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean)
    if (!recipientEmails.length) return
    const draft = { frequency, dayOfWeek: Number(dayOfWeek), dayOfMonth: Number(dayOfMonth), intervalDays: Math.max(1, Number(intervalDays) || 15), time }
    await db.recurringReports.add({ id: crypto.randomUUID(), orgId, scope, workspaceId, projectId, reportType, recipientEmails, ...draft, enabled: true, createdAt: new Date().toISOString(), nextRunAt: nextReportRun(draft) })
    setOpen(false)
  }

  async function runNow(report: RecurringReport) {
    if (!canManage) return
    const sentAt = new Date().toISOString()
    await db.recurringReports.update(report.id, { lastRunAt: sentAt, nextRunAt: nextReportRun(report) })
    await db.auditLogs.add({ id: crypto.randomUUID(), orgId, actorName: 'Report scheduler', action: 'Generated report', target: `${REPORT_TYPE_LABELS[report.reportType]} queued for ${report.recipientEmails.join(', ')}`, createdAt: sentAt })
  }

  return <div className="flex flex-col gap-4 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Recurring reports</h2><p className="text-sm text-muted-foreground">Automatically generate scheduled {scope} reports for the people who need them.</p></div>{canManage && <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden="true" /> New recurring report</Button>}</div>
    {reports?.length ? <div className="grid gap-3">{reports.map((report) => <Card key={report.id}><CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{REPORT_TYPE_LABELS[report.reportType]}</p><Badge variant={report.enabled ? 'success' : 'secondary'}>{report.enabled ? 'Active' : 'Paused'}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden="true" />{describeSchedule(report)}</p><p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground"><Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="break-all">{report.recipientEmails.join(', ')}</span></p></div><div className="flex items-center gap-2 self-end sm:self-auto">{canManage && <><Button variant="outline" size="sm" onClick={() => void runNow(report)}><Send className="size-3.5" aria-hidden="true" /> Run now</Button><Switch aria-label={`Enable ${REPORT_TYPE_LABELS[report.reportType]} report`} checked={report.enabled} onCheckedChange={(enabled) => { if (canManage) void db.recurringReports.update(report.id, { enabled }) }} /><Button aria-label="Delete recurring report" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { if (canManage) void db.recurringReports.delete(report.id) }}><Trash2 className="size-4" aria-hidden="true" /></Button></>}</div></CardContent></Card>)}</div> : <EmptyState icon={CalendarClock} title="No recurring reports" description={`Schedule a ${scope} report for weekly, monthly, or custom delivery.`} actionLabel={canManage ? 'New recurring report' : undefined} onAction={canManage ? () => setOpen(true) : undefined} />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>New recurring report</DialogTitle><DialogDescription>Set the report, recipients, and delivery schedule for this {scope}.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>Report type</Label><Select value={reportType} onValueChange={(v) => setReportType(v as RecurringReportType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="report-recipients">Recipients</Label><textarea id="report-recipients" value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} placeholder="manager@company.com" className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20" /><p className="text-xs text-muted-foreground">One or more addresses, separated by a comma, semicolon, or new line.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Frequency</Label><Select value={frequency} onValueChange={(v) => setFrequency(v as ReportFrequency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="report-time">Time</Label><Input id="report-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div></div>{frequency === 'weekly' && <div className="grid gap-2"><Label>Day of week</Label><Select value={dayOfWeek} onValueChange={setDayOfWeek}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WEEKDAYS.map((day, i) => <SelectItem key={day} value={String(i)}>{day}</SelectItem>)}</SelectContent></Select></div>}{frequency === 'monthly' && <div className="grid gap-2"><Label htmlFor="report-day-month">Day of month</Label><Input id="report-day-month" type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} /></div>}{frequency === 'custom' && <div className="grid gap-2"><Label htmlFor="report-interval">Repeat every (days)</Label><Input id="report-interval" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={!emails.trim()}>Create schedule</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
