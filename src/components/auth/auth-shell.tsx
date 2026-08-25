import type { ReactNode } from 'react'
import { CheckCircle2, Waypoints } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AuthShell({ children, heading, description }: { children: ReactNode; heading: string; description: string }) {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(28rem,42%)]">
      <section className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 -right-24 size-80 rounded-full bg-accent/20 blur-3xl" />
        <Link to="/" className="relative flex w-fit items-center gap-2 rounded-lg font-bold focus-visible:outline-offset-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary"><Waypoints className="size-5" aria-hidden="true" /></span>
          Connectio
        </Link>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">A clean start for every team</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">Create the structure your work needs from a clean, intentional starting point.</h2>
          <ul className="mt-8 space-y-4 text-sm text-background/75">
            {['Your account stays separate from every organization.', 'Plans and limits come from platform configuration.', 'Onboarding resumes exactly where you left it.'].map((item) => (
              <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-background/50">Secure account access · Explicit tenant membership · Clean workspace setup</p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex w-fit items-center gap-2 rounded-lg font-bold lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Waypoints className="size-5" aria-hidden="true" /></span>
            Connectio
          </Link>
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{heading}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}
