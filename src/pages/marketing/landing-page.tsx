import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  GanttChartSquare,
  Layers3,
  LayoutDashboard,
  Milestone,
  Sparkles,
  Ticket as TicketIcon,
  Users,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/ui/avatar'
import { PricingCards } from '@/components/marketing/pricing-cards'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const VALUE_PROPS = [
  {
    icon: Workflow,
    title: 'Plan sprints, not spreadsheets',
    description: 'Workspaces, projects, sprints, tasks, and subtasks in one connected hierarchy your whole org can see.',
  },
  {
    icon: TicketIcon,
    title: 'Turn support into structured work',
    description: 'A public ticket portal that converts straight into tasks, with categories, SLAs, and automation as you grow.',
  },
  {
    icon: GanttChartSquare,
    title: 'See everything, on one timeline',
    description: 'Milestones, calendars, and Gantt views keep every team aligned on what ships next.',
  },
]

const FEATURES = [
  { icon: LayoutDashboard, title: 'Basic Monitoring', description: 'Live status across every project, out of the box on every plan.' },
  { icon: Users, title: 'Teams & Workspaces', description: 'Organize people into teams and work into workspaces that scale with you.' },
  { icon: Milestone, title: 'Milestones & Scheduling', description: 'Set project start/end dates and track the milestones that matter.' },
  { icon: Calendar, title: 'Calendar', description: 'A shared calendar view of sprints, milestones, and due dates.' },
  { icon: GanttChartSquare, title: 'Gantt / Timeline', description: 'Visualize how projects overlap and where the critical path is.' },
  { icon: TicketIcon, title: 'Project Ticketing', description: 'Categories, attachments, and a public portal for customer requests.' },
  { icon: Layers3, title: 'SLA & Automation', description: 'Business-tier SLA policies and automation rules that triage for you.' },
  { icon: Sparkles, title: 'Custom Forms & API', description: 'Tailor intake forms and integrate Connectio into your own stack.' },
]

const TESTIMONIALS = [
  {
    name: 'Maya Chen',
    title: 'Head of Ops, Northwind Studio',
    quote: 'We outgrew spreadsheets in a weekend. Connectio gave our five-person team real sprints without the overhead.',
  },
  {
    name: 'Sofia Singh',
    title: 'Delivery Lead, Bright Collective',
    quote: 'The Gantt view plus the ticket portal replaced two separate tools we were paying for. Onboarding took an afternoon.',
  },
  {
    name: 'Priya Haddad',
    title: 'VP Engineering, Nova Industries',
    quote: "SLAs and automation rules on the Business plan cut our first-response time in half. It's the first PM tool support actually likes.",
  },
]

const FAQS = [
  {
    q: 'Is this a real product I can sign up for?',
    a: 'Yes. Registration creates your user account, then guided onboarding creates a clean organization and first workspace for you.',
  },
  {
    q: 'What happens when I hit a plan limit?',
    a: "You'll see the limit on the relevant screen and a one-click path to upgrade. Locked features show a lock icon with an explanation instead of failing silently.",
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes — upgrades and downgrades are available any time from Organization Settings → Billing, and take effect immediately.',
  },
  {
    q: 'Does the public ticket portal require a login?',
    a: 'No. Pro and Business organizations get a public, unauthenticated portal URL customers can use to submit tickets directly.',
  },
]

export function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_srgb,var(--color-primary)_15%,transparent),transparent)]" />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-xs">
            <Sparkles className="size-3.5 text-accent" />
            Project management, ticketing, and delivery in one place
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Run your projects and your support desk from one connected workspace
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Connectio brings sprints, tasks, milestones, and a full ticketing system together — with plans that grow
            from a five-person team to an unlimited organization.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant="accent" asChild>
              <Link to="/register">
                Start free demo <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View pricing</Link>
            </Button>
          </div>

          {/* Product preview mock */}
          <div className="glass mt-10 w-full max-w-4xl rounded-2xl p-3 shadow-xl sm:p-4">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
              </div>
              <div className="grid grid-cols-3 gap-3 text-left">
                {['Backlog', 'In Progress', 'Review'].map((col, ci) => (
                  <div key={col} className="rounded-lg bg-muted p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col}</p>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: ci === 0 ? 3 : 2 }).map((_, i) => (
                        <div key={i} className="rounded-md border border-border bg-card p-2.5 shadow-xs">
                          <div className="mb-2 h-2 w-3/4 rounded bg-border" />
                          <div className="flex items-center justify-between">
                            <div className="h-2 w-10 rounded bg-primary/20" />
                            <div className="size-4 rounded-full bg-accent/30" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <Card key={v.title} className="p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <v.icon className="size-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{v.title}</h3>
              <p className="text-sm text-muted-foreground">{v.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="border-y border-border bg-card py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">Everything included</span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From basic monitoring to enterprise SLAs
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Every plan starts with real project management. Higher tiers layer on scheduling, ticketing, and
              automation as your team grows.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-5 transition-colors duration-200 hover:border-primary/40">
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <f.icon className="size-4" />
                </div>
                <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Pricing</span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Plans that scale with your team</h2>
          <p className="max-w-xl text-muted-foreground">
            Start free, upgrade the moment you need scheduling and ticketing, and move to Business when you need SLAs
            and the API.
          </p>
        </div>
        <PricingCards />
        <div className="mt-8 flex justify-center">
          <Button variant="link" asChild>
            <Link to="/pricing">
              See the full feature comparison <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border bg-card py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">Teams on Connectio</span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Loved by teams of every size</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="flex flex-col gap-4 p-6">
                <div className="flex gap-1 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <CheckCircle2 key={i} className="size-3.5" />
                  ))}
                </div>
                <p className="flex-1 text-sm text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2">
                  <InitialsAvatar name={t.name} className="size-9" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.title}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">FAQ</span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Questions, answered</h2>
        </div>
        <Accordion type="single" collapsible>
          {FAQS.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-primary px-6 py-16 text-center shadow-xl sm:px-12">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to see it running with real data?
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            Jump into a seeded Free, Pro, or Business organization — no signup form required.
          </p>
          <Button size="lg" variant="accent" asChild>
            <Link to="/register">
              Start free demo <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
