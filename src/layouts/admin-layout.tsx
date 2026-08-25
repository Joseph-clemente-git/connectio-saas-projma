import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Layers,
  Users,
  Flag,
  Settings,
  Waypoints,
  LogOut,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-session-data'
import { useSession } from '@/store/session'
import { InitialsAvatar } from '@/components/ui/avatar'
import { LoadingScreen } from '@/components/shared/loading-screen'
import { Badge } from '@/components/ui/badge'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', to: '/admin/organizations', icon: Building2 },
  { label: 'Revenue & billing', to: '/admin/billing', icon: CreditCard },
  { label: 'Plans', to: '/admin/plans', icon: Layers },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Feature Flags', to: '/admin/feature-flags', icon: Flag },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

export function AdminLayout() {
  const isAuthenticated = useSession((s) => s.isAuthenticated)
  const signOut = useSession((s) => s.signOut)
  const user = useCurrentUser()
  const navigate = useNavigate()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user === undefined) return <LoadingScreen />
  if (!user || user.role !== 'super_admin') return <Navigate to="/app" replace />

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-foreground text-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Waypoints className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight">Connectio</span>
            <Badge className="w-fit border-transparent bg-accent/20 px-1.5 py-0 text-[10px] text-accent">
              Super Admin
            </Badge>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-background/70 transition-colors hover:bg-white/10 hover:text-background',
                    isActive && 'bg-white/10 text-background',
                  )
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <InitialsAvatar name={user.name} color={user.avatarColor} className="size-9" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-background/60">{user.email}</span>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            className="cursor-pointer rounded-md p-1.5 text-background/70 transition-colors hover:bg-white/10 hover:text-background"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
