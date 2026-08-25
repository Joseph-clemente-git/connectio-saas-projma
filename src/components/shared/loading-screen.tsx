import { Waypoints } from 'lucide-react'

export function LoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-pulse">
        <Waypoints className="size-5" />
      </div>
      <span className="text-sm">Loading…</span>
    </div>
  )
}
