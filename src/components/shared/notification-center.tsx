import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNow } from 'date-fns'
import {
  Activity,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  FileText,
  MessageSquareText,
  UserPlus,
} from 'lucide-react'
import { db } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { AuditLog, Organization, User } from '@/types/domain'

const MAX_VISIBLE_NOTIFICATIONS = 10

function notificationStyle(action: string) {
  const normalizedAction = action.toLowerCase()

  if (normalizedAction.includes('approv') || normalizedAction.includes('complet')) {
    return { icon: CheckCircle2, className: 'bg-success/10 text-success' }
  }
  if (normalizedAction.includes('comment') || normalizedAction.includes('message')) {
    return { icon: MessageSquareText, className: 'bg-primary/10 text-primary' }
  }
  if (normalizedAction.includes('invit') || normalizedAction.includes('member') || normalizedAction.includes('assign')) {
    return { icon: UserPlus, className: 'bg-accent/10 text-accent' }
  }
  if (normalizedAction.includes('file') || normalizedAction.includes('report') || normalizedAction.includes('import')) {
    return { icon: FileText, className: 'bg-warning/10 text-warning' }
  }
  if (normalizedAction.includes('due') || normalizedAction.includes('schedule') || normalizedAction.includes('sprint')) {
    return { icon: CalendarClock, className: 'bg-warning/10 text-warning' }
  }

  return { icon: Activity, className: 'bg-muted text-muted-foreground' }
}

function NotificationItem({ notification, unread }: { notification: AuditLog; unread: boolean }) {
  const presentation = notificationStyle(notification.action)
  const Icon = presentation.icon

  return (
    <li className={cn('relative flex gap-3 px-4 py-3', unread && 'bg-primary/[0.04]')}>
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', presentation.className)}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-foreground">
          <span className="font-semibold">{notification.actorName}</span>{' '}
          {notification.action}{' '}
          <span className="font-medium">{notification.target}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      {unread && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread notification" />
      )}
    </li>
  )
}

export function NotificationCenter({ org, user }: { org: Organization; user: User }) {
  const readMarkerKey = `notifications-read:${org.id}:${user.id}`
  const notifications = useLiveQuery(
    () => db.auditLogs.where('orgId').equals(org.id).reverse().sortBy('createdAt'),
    [org.id],
  ) ?? []
  const readAt = useLiveQuery(async () => (await db.meta.get(readMarkerKey))?.value, [readMarkerKey])
  const unreadCount = notifications.filter((notification) => !readAt || notification.createdAt > readAt).length
  const visibleNotifications = notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS)

  async function markAllAsRead() {
    const newestCreatedAt = notifications[0]?.createdAt ?? new Date().toISOString()
    await db.meta.put({ key: readMarkerKey, value: newestCreatedAt })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          className="relative flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Bell aria-hidden="true" className="size-4" />
          {unreadCount > 0 && (
            <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-card">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),24rem)] overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Notifications</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Recent organization activity</p>
          </div>
          {unreadCount > 0 && (
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => void markAllAsRead()}>
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>

        <span className="sr-only" aria-live="polite">
          {unreadCount ? `${unreadCount} unread notifications` : 'No unread notifications'}
        </span>

        {visibleNotifications.length > 0 ? (
          <ul className="max-h-[min(32rem,calc(100svh-8rem))] divide-y divide-border overflow-y-auto overscroll-contain" aria-label="Recent notifications">
            {visibleNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                unread={!readAt || notification.createdAt > readAt}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell aria-hidden="true" className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">You're all caught up</p>
            <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">Project updates and organization activity will appear here.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
