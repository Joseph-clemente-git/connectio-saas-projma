import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PwaStatus } from '@/components/shared/pwa-status'
import { router } from '@/router'

function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <RouterProvider router={router} />
      <PwaStatus />
    </TooltipProvider>
  )
}

export default App
