import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { replaceTemporaryPassword, validatePassword } from '@/lib/auth'
import { useSession } from '@/store/session'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { userId, sessionToken } = useSession()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const validationError = validatePassword(password)
    if (validationError) { setError(validationError); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (!userId || !sessionToken) { navigate('/login', { replace: true }); return }
    setSubmitting(true)
    try {
      await replaceTemporaryPassword({ userId, sessionToken, password })
      const next = searchParams.get('next')
      window.location.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/app')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell heading="Create a new password" description="For your security, replace the temporary password before entering your organization.">
      <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">This is required once. Your new password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.</div>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" aria-invalid={Boolean(error)} autoFocus />
            <button type="button" className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button>
          </div>
        </div>
        <div className="space-y-2"><Label htmlFor="confirm-new-password">Confirm new password</Label><Input id="confirm-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(error)} /></div>
        {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !password || !confirmPassword}>{submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{submitting ? 'Saving password…' : 'Set new password'}</Button>
      </form>
    </AuthShell>
  )
}
