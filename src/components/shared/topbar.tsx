import { useNavigate } from 'react-router-dom'
import { ChevronDown, CircleHelp, LogOut, Menu } from 'lucide-react'
import { InitialsAvatar } from '@/components/ui/avatar'
import { PlanBadge } from '@/components/shared/plan-badge'
import { NotificationCenter } from '@/components/shared/notification-center'
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
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 px-2 sm:px-3"
          onClick={() => window.dispatchEvent(new Event('connectio:start-product-tour'))}
          aria-label="Start guided tutorial"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Help</span>
        </Button>
        <NotificationCenter org={org} user={user} />
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
