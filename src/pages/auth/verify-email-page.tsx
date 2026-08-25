import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, LoaderCircle, MailCheck } from 'lucide-react'
import { resendVerification, verifyEmail } from '@/lib/auth'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const invite = searchParams.get('invite')
  const initialCode = (location.state as { developmentCode?: string } | null)?.developmentCode
  const [code, setCode] = useState('')
  const [developmentCode, setDevelopmentCode] = useState(initialCode ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await verifyEmail(email, code)
      const query = new URLSearchParams({ email })
      if (invite) query.set('invite', invite)
      navigate(`/login?${query.toString()}`, { replace: true, state: { verified: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify this email.')
    } finally { setSubmitting(false) }
  }

  async function resend() {
    const next = await resendVerification(email)
    if (next) setDevelopmentCode(next)
    else setError('This account is already verified or could not be found.')
  }

  return (
    <AuthShell heading="Verify your email" description={`Enter the six-digit code sent to ${email || 'your email address'}. Codes expire after 15 minutes.`}>
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><MailCheck className="size-6" aria-hidden="true" /></div>
      {developmentCode && <div className="mb-5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><p className="font-semibold text-foreground">Local development delivery</p><p className="mt-1 text-muted-foreground">Email delivery is not configured. Your verification code is <strong className="font-mono text-foreground">{developmentCode}</strong>.</p></div>}
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="text-center font-mono text-xl tracking-[0.35em]" /></div>
        {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting || code.length !== 6}>{submitting ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{submitting ? 'Verifying…' : 'Verify email'}</Button>
      </form>
      <div className="mt-6 flex items-center justify-between gap-4 text-sm"><button type="button" onClick={() => void resend()} className="cursor-pointer font-semibold text-primary hover:underline">Send a new code</button><Link to="/login" className="text-muted-foreground hover:text-foreground">Back to sign in</Link></div>
    </AuthShell>
  )
}
