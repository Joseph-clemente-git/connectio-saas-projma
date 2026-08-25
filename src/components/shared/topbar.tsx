import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { InitialsAvatar } from '@/components/ui/avatar'
import { PlanBadge } from '@/components/shared/plan-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'
import type { Organization, User } from '@/types/domain'

export function Topbar({
  org,
  user,
  onMenuClick,
}: {
  org: Organization
  user: User
  onMenuClick?: () => void
}) {
  const navigate = useNavigate()
  const signOut = useSession((s) => s.signOut)
  const unread = useLiveQuery(async () => {
    const conversations = await db.chatConversations.where('orgId').equals(org.id).toArray()
    const reads = await db.chatReadStates.where('userId').equals(user.id).toArray()
    const readByConversation = new Map(reads.map((read) => [read.conversationId, read.readAt]))
    const counts = await Promise.all(conversations.map(async (conversation) => {
      const latest = await db.chatMessages.where('conversationId').equals(conversation.id).last()
      return latest && latest.authorId !== user.id && (!readByConversation.get(conversation.id) || latest.createdAt > readByConversation.get(conversation.id)!) ? 1 : 0
    }))
    return counts.reduce<number>((total, count) => total + count, 0)
  }, [org.id, user.id]) ?? 0

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{org.name}</span>
          <PlanBadge plan={org.plan} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${unread} unread chat notification${unread === 1 ? '' : 's'}`} className="relative flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => navigate(`/app/${org.slug}/chat`)}>
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <InitialsAvatar name={user.name} color={user.avatarColor} className="size-8" />
            <span className="hidden text-sm font-medium text-foreground sm:inline">{user.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  )
}
