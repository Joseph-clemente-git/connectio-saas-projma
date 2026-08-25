import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { db } from '@/db/schema'
import { authenticate, normalizeEmail } from '@/lib/auth'
import { useSession } from '@/store/session'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invite = searchParams.get('invite')
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const signIn = useSession((state) => state.signIn)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const session = await authenticate(email, password)
      const membership = await db.orgMembers.where('userId').equals(session.user.id).first()
      signIn(session.user.id, membership?.orgId ?? null, session.token)
      const destination = invite ? `/invite/${encodeURIComponent(invite)}` : '/app'
      navigate(session.mustChangePassword ? `/change-password?next=${encodeURIComponent(destination)}` : destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const registerUrl = invite ? `/register?invite=${encodeURIComponent(invite)}` : '/register'
  const verifyUrl = `/verify?email=${encodeURIComponent(normalizeEmail(email))}${invite ? `&invite=${encodeURIComponent(invite)}` : ''}`

  return (
    <AuthShell heading="Welcome back" description="Sign in to continue to your organization, resume onboarding, or open platform administration.">
      {invite && <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">Sign in with the email address that received this invitation.</div>}
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email address</Label>
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" aria-invalid={Boolean(error)} />
            <button type="button" className="absolute right-1 top-1 flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
            </button>
          </div>
        </div>
        {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}{error.includes('Verify your email') && <> <Link to={verifyUrl} className="font-semibold underline">Verify now</Link>.</>}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !email.trim() || !password}>
          {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">New to Connectio? <Link to={registerUrl} className="font-semibold text-primary hover:underline">Create an account</Link></p>
    </AuthShell>
  )
}
