import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Handles SW update prompts, offline-ready toast, and the "Install app" affordance. Mount once near the app root. */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registration?.update()
    },
  })

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const showInstall = installEvent && !installed && !installDismissed

  if (!needRefresh && !offlineReady && !showInstall) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {needRefresh && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <RefreshCw className="size-4 text-primary" />
          <span className="text-sm text-foreground">A new version is available.</span>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
          <button
            type="button"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {!needRefresh && offlineReady && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <WifiOff className="size-4 text-success" />
          <span className="text-sm text-foreground">Connectio is ready to work offline.</span>
          <button
            type="button"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setOfflineReady(false)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {!needRefresh && showInstall && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <Download className="size-4 text-primary" />
          <span className="text-sm text-foreground">Install Connectio for quick, offline access.</span>
          <Button
            size="sm"
            variant="accent"
            onClick={async () => {
              await installEvent?.prompt()
              setInstallEvent(null)
            }}
          >
            Install
          </Button>
          <button
            type="button"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setInstallDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
