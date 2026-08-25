import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { getInvitationByToken, registerAccount, validatePassword } from '@/lib/auth'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!invite) return
    void getInvitationByToken(invite).then((entry) => {
      if (entry?.status === 'pending') {
        setInvitedEmail(entry.targetEmail)
        setEmail(entry.targetEmail)
      }
    })
  }, [invite])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const passwordError = validatePassword(password)
    if (passwordError) { setError(passwordError); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setSubmitting(true)
    try {
      const result = await registerAccount({ name, email, password })
      const query = new URLSearchParams({ email: result.user.email })
      if (invite) query.set('invite', invite)
      navigate(`/verify?${query.toString()}`, { state: { developmentCode: result.developmentVerificationCode } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  const loginUrl = invite ? `/login?invite=${encodeURIComponent(invite)}` : '/login'
  return (
    <AuthShell heading={invite ? 'Join your team' : 'Create your account'} description={invite ? 'Create a user account first. Accepting the invitation will connect it to the existing organization.' : 'Registration creates only your user account. Organization setup comes after verification and sign-in.'}>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-2"><Label htmlFor="register-name">Full name</Label><Input id="register-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="register-email">Email address</Label><Input id="register-email" type="email" autoComplete="email" required readOnly={Boolean(invitedEmail)} value={email} onChange={(event) => setEmail(event.target.value)} className={invitedEmail ? 'bg-muted/40' : undefined} /></div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <div className="relative"><Input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" /><button type="button" className="absolute right-1 top-1 flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div>
          <p className="text-xs leading-5 text-muted-foreground">At least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="register-confirm">Confirm password</Label><Input id="register-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
        {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !name.trim() || !email.trim() || !password || !confirmPassword}>{submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{submitting ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">Already have an account? <Link to={loginUrl} className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </AuthShell>
  )
}
