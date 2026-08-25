import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Building2, CheckCircle2, Clock3, LoaderCircle, Mail, ShieldCheck, Waypoints } from 'lucide-react'
import { acceptInvitation, getInvitationByToken, validateSession } from '@/lib/auth'
import { db } from '@/db/schema'
import { useSession } from '@/store/session'
import type { Organization, OrganizationInvitation, User } from '@/types/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface InvitationContext { invitation: OrganizationInvitation; org?: Organization; inviter?: User }

export function InvitationPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const [context, setContext] = useState<InvitationContext | null | undefined>(undefined)
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getInvitationByToken(token), validateSession(session.sessionToken, session.userId)]).then(async ([invitation, user]) => {
      if (cancelled) return
      setAuthenticated(Boolean(user))
      if (!invitation) { setContext(null); return }
      const [org, inviter] = await Promise.all([db.organizations.get(invitation.orgId), db.users.get(invitation.inviterId)])
      if (!cancelled) setContext({ invitation, org, inviter })
    })
    return () => { cancelled = true }
  }, [session.sessionToken, session.userId, token])

  async function accept() {
    if (!session.userId) return
    setSubmitting(true)
    setError('')
    try {
      const orgId = await acceptInvitation(token, session.userId)
      session.switchOrg(orgId)
      navigate('/app', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to accept this invitation.')
    } finally { setSubmitting(false) }
  }

  if (context === undefined) return <div className="flex min-h-svh items-center justify-center bg-background"><LoaderCircle className="size-7 animate-spin text-primary" aria-label="Loading invitation" /></div>
  const invalid = !context || context.invitation.status !== 'pending'
  const authQuery = encodeURIComponent(token)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <Link to="/" className="mx-auto mb-8 flex w-fit items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Waypoints className="size-5" /></span>Connectio</Link>
        <Card>
          <CardHeader className="items-center text-center">
            <div className={`mb-3 flex size-14 items-center justify-center rounded-2xl ${invalid ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{invalid ? <Clock3 /> : <Mail />}</div>
            <CardTitle>{invalid ? 'Invitation unavailable' : `Join ${context.org?.name ?? 'this organization'}`}</CardTitle>
            <CardDescription>{invalid ? 'This invitation is invalid, expired, revoked, or has already been accepted.' : `${context.inviter?.name ?? 'An organization owner'} invited you to collaborate in Connectio.`}</CardDescription>
          </CardHeader>
          {!invalid && <CardContent className="space-y-5">
            <dl className="divide-y divide-border rounded-lg border border-border bg-muted/20 px-4 text-sm">
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted-foreground"><Building2 className="size-4" />Organization</dt><dd className="font-medium">{context.org?.name}</dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-4" />Access</dt><dd><Badge variant="secondary" className="capitalize">{context.invitation.role}</Badge></dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="flex items-center gap-2 text-muted-foreground"><Mail className="size-4" />Invited email</dt><dd className="truncate font-medium">{context.invitation.targetEmail}</dd></div>
            </dl>
            {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            {authenticated ? <Button size="lg" className="w-full" onClick={() => void accept()} disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{submitting ? 'Joining…' : 'Accept invitation'}</Button> : <div className="grid gap-3 sm:grid-cols-2"><Button asChild size="lg"><Link to={`/login?invite=${authQuery}`}>Sign in</Link></Button><Button asChild size="lg" variant="outline"><Link to={`/register?invite=${authQuery}`}>Create account</Link></Button></div>}
          </CardContent>}
        </Card>
      </div>
    </main>
  )
}
