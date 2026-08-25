import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Users2,
  UserCircle,
  FolderKanban,
  CalendarDays,
  Ticket,
  Settings,
  Route,
  Lock,
  Waypoints,
  MessageCircle,
  FolderOpen,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeatureKey, PlanConfig } from '@/lib/plans'
import { hasFeature } from '@/lib/entitlements'
import { useUpgradeDialog } from '@/store/upgrade'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOrgMemberRole } from '@/hooks/use-session-data'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  feature?: FeatureKey
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: 'dashboard', icon: LayoutDashboard },
  { label: 'Teams', to: 'teams', icon: Users2 },
  { label: 'Members', to: 'members', icon: UserCircle },
  { label: 'Workspaces', to: 'workspaces', icon: FolderKanban },
  { label: 'Files', to: 'files', icon: FolderOpen },
  { label: 'Calendar', to: 'calendar', icon: CalendarDays, feature: 'calendar' },
  { label: 'Tickets', to: 'tickets', icon: Ticket, feature: 'projectTicketing' },
  { label: 'Chat', to: 'chat', icon: MessageCircle },
  { label: 'Settings', to: 'settings/org', icon: Settings },
  { label: 'Project settings', to: 'settings/workflows', icon: Route },
]

export function Sidebar({ plan, orgId, userId, onNavigate }: { plan: PlanConfig; orgId: string; userId: string; onNavigate?: () => void }) {
  const { orgSlug } = useParams()
  const openUpgrade = useUpgradeDialog((s) => s.openUpgrade)
  const membership = useOrgMemberRole(orgId, userId)
  const visibleItems: NavItem[] = membership?.role === 'owner'
    ? [...NAV_ITEMS.slice(0, -1), { label: 'Plan & billing', to: 'settings/billing', icon: CreditCard }, NAV_ITEMS[NAV_ITEMS.length - 1]]
    : NAV_ITEMS

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Waypoints className="size-4" />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Connectio</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const locked = item.feature ? !hasFeature(plan, item.feature) : false
          const Icon = item.icon

          if (locked) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      openUpgrade(item.label, plan.id === 'free' ? 'pro' : 'business')
                      onNavigate?.()
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60 transition-colors hover:bg-muted"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <Lock className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Upgrade to unlock {item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={`/app/${orgSlug}/${item.to}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted',
                  isActive && 'bg-primary/10 text-primary hover:bg-primary/10',
                )
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
