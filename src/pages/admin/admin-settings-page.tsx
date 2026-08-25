import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { resetDatabase } from '@/db/seed'
import { useSession } from '@/store/session'

export function AdminSettingsPage() {
  const navigate = useNavigate()
  const signOut = useSession((s) => s.signOut)
  const [platformName, setPlatformName] = useState('Connectio')
  const [supportEmail, setSupportEmail] = useState('support@connectio.app')
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    setResetting(true)
    await resetDatabase()
    signOut()
    setResetting(false)
    navigate('/login')
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Platform settings" description="Global configuration for the Connectio instance." />
      <div className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Platform identity and support contact configuration.</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="platform-name">Platform name</Label>
              <Input id="platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="support-email">Support email</Label>
              <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" /> Danger zone
            </CardTitle>
            <CardDescription>Deletes all tenant and regular-account data while preserving Plans and Super Admin access. Cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              <RotateCcw className="size-4" /> {resetting ? 'Resetting…' : 'Delete all tenant data'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
