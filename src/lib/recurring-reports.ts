import type { RecurringReport } from '@/types/domain'
import { db } from '@/db/schema'

export const REPORT_TYPE_LABELS = {
  project_status: 'Project status',
  task_progress: 'Task progress',
  workload: 'Team workload',
  summary: 'Workspace summary',
} as const

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function describeSchedule(report: Pick<RecurringReport, 'frequency' | 'dayOfWeek' | 'dayOfMonth' | 'intervalDays' | 'time'>) {
  const time = new Date(`2000-01-01T${report.time || '08:00'}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (report.frequency === 'weekly') return `Every ${WEEKDAYS[report.dayOfWeek ?? 1]} at ${time}`
  if (report.frequency === 'monthly') return `Every ${report.dayOfMonth ?? 1}${ordinal(report.dayOfMonth ?? 1)} day of the month at ${time}`
  return `Every ${report.intervalDays ?? 15} days at ${time}`
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return 'th'
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
}

export function nextReportRun(report: Pick<RecurringReport, 'frequency' | 'dayOfWeek' | 'dayOfMonth' | 'intervalDays' | 'time'>, from = new Date()) {
  const [hours, minutes] = (report.time || '08:00').split(':').map(Number)
  if (report.frequency === 'monthly') {
    const dateForMonth = (year: number, month: number) => {
      const day = Math.min(report.dayOfMonth ?? 1, new Date(year, month + 1, 0).getDate())
      return new Date(year, month, day, hours, minutes, 0, 0)
    }
    const current = dateForMonth(from.getFullYear(), from.getMonth())
    const next = current > from ? current : dateForMonth(from.getFullYear(), from.getMonth() + 1)
    return next.toISOString()
  }
  const next = new Date(from)
  next.setSeconds(0, 0)
  next.setHours(hours, minutes, 0, 0)
  if (report.frequency === 'weekly') {
    const days = ((report.dayOfWeek ?? 1) - next.getDay() + 7) % 7
    next.setDate(next.getDate() + (days || (next <= from ? 7 : 0)))
  } else {
    next.setDate(next.getDate() + (report.intervalDays ?? 15))
  }
  return next.toISOString()
}

/** Records due deliveries in the local demo. Replace this boundary with a server mail job in production. */
export async function processDueRecurringReports(orgId: string) {
  const now = new Date()
  const due = await db.recurringReports.where('orgId').equals(orgId).filter((report) => report.enabled && new Date(report.nextRunAt) <= now).toArray()
  await Promise.all(due.map(async (report) => {
    const sentAt = now.toISOString()
    await db.recurringReports.update(report.id, { lastRunAt: sentAt, nextRunAt: nextReportRun(report, now) })
    await db.auditLogs.add({ id: crypto.randomUUID(), orgId, actorName: 'Report scheduler', action: 'Generated report', target: `${REPORT_TYPE_LABELS[report.reportType]} queued for ${report.recipientEmails.join(', ')}`, createdAt: sentAt })
  }))
}
