import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '@/db/schema'
import { stagesForPreset, terminologyForPreset } from '@/lib/project-workflow'
import { Button } from '@/components/ui/button'
import type { Organization, User } from '@/types/domain'
import { projectCodePrefix } from '@/lib/task-code'

interface TourContext {
  workspaceId: string
  projectId: string
  sprintId: string
  taskId?: string
}

interface TourStep {
  eyebrow: string
  title: string
  description: string
  target?: string
  actionLabel?: string
  waitingLabel?: string
}

const LAST_STEP = 10

function completionKey(orgId: string, userId: string) {
  return `connectio:product-tour:${orgId}:${userId}`
}

function expectedLocation(step: number, orgSlug: string, context: TourContext | null) {
  if (step === 1) return `/app/${orgSlug}/dashboard`
  if (step === 2) return `/app/${orgSlug}/workspaces`
  if (step === 3 && context) return `/app/${orgSlug}/workspaces/${context.workspaceId}`
  if (step >= 4 && step <= LAST_STEP && context) return `/app/${orgSlug}/projects/${context.projectId}`
  return null
}

export function ProductTour({ org, user, membershipRole }: { org: Organization; user: User; membershipRole: 'owner' | 'admin' | 'member' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [context, setContext] = useState<TourContext | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const navigationRef = useRef(false)

  const steps = useMemo<TourStep[]>(() => [
    {
      eyebrow: 'Welcome to Connectio',
      title: 'Create your first task, step by step',
      description: 'This hands-on tour uses your real workspace. We’ll visit each screen in the delivery flow, then you’ll create a task that stays on your board.',
      actionLabel: 'Start tutorial',
    },
    {
      eyebrow: 'Step 1 of 9 · Dashboard',
      title: 'Start with the big picture',
      description: 'Your dashboard summarizes people, workspaces, active projects, and task activity across every workflow.',
      target: '[data-tour="dashboard-summary"]',
      actionLabel: 'Explore workspaces',
    },
    {
      eyebrow: 'Step 2 of 9 · Workspaces',
      title: 'Workspaces keep related projects together',
      description: 'A workspace is the home for a team or area of work. We’ll use this one for the tutorial.',
      target: context ? `[data-tour-workspace="${context.workspaceId}"]` : undefined,
      actionLabel: 'Open workspace',
    },
    {
      eyebrow: 'Step 3 of 9 · Projects',
      title: 'Projects hold the delivery workflow',
      description: 'Inside a workspace, each project has its own stages, sprints, milestones, files, and reporting. This is where the task will live.',
      target: context ? `[data-tour-project="${context.projectId}"]` : undefined,
      actionLabel: 'Open project',
    },
    {
      eyebrow: 'Step 4 of 9 · Project overview',
      title: 'Every project screen is one tab away',
      description: 'Use these tabs to move between the overview, board, task data, reports, sprints, milestones, resources, and settings.',
      target: '[data-tour="project-tabs"]',
      actionLabel: 'See sprint planning',
    },
    {
      eyebrow: 'Step 5 of 9 · Sprints',
      title: 'Sprints turn outcomes into a delivery window',
      description: 'Tasks are committed to a sprint before they appear on the board. A ready-to-use sprint is selected for this tutorial.',
      target: '[data-tour="sprints-panel"]',
      actionLabel: 'Go to the board',
    },
    {
      eyebrow: 'Step 6 of 9 · Board',
      title: 'Focus the board on one sprint',
      description: 'The sprint filter keeps the board focused. Your tutorial sprint is already selected, so new work will be committed to it.',
      target: '[data-tour="board-sprint"]',
      actionLabel: 'Create a task',
    },
    {
      eyebrow: 'Step 7 of 9 · Create',
      title: 'Add real work to the first stage',
      description: 'Click the highlighted Add task button. This opens a quick entry directly on the board.',
      target: '[data-tour="add-task"]',
      waitingLabel: 'Waiting for you to click Add task…',
    },
    {
      eyebrow: 'Step 8 of 9 · Name it',
      title: 'Give the task a clear action title',
      description: 'Type something your team can act on, then press Enter. The task is saved to this project—not a simulation.',
      target: '[data-tour="task-title"]',
      waitingLabel: 'Type a title and press Enter…',
    },
    {
      eyebrow: 'Step 9 of 9 · Your task',
      title: 'Your task is live on the board',
      description: 'The card shows priority, dates, assignee, review state, and activity at a glance. Open it to add the details your team needs.',
      target: context?.taskId ? `[data-tour-task="${context.taskId}"]` : undefined,
      actionLabel: 'Open task details',
    },
    {
      eyebrow: 'Task details',
      title: 'Turn the task into an executable plan',
      description: 'Add a description, owner, due date, subtasks, files, and comments here. Changes save directly to the task.',
      target: '[data-tour="task-detail"]',
      actionLabel: 'Finish tutorial',
    },
    {
      eyebrow: 'Tutorial complete',
      title: 'You’re ready to deliver',
      description: 'You navigated the full path from dashboard to task details and created real work along the way. Replay this tour anytime from Help in the top bar.',
      actionLabel: 'Done',
    },
  ], [context])

  const current = steps[step]

  const close = useCallback((completed = false) => {
    if (completed) localStorage.setItem(completionKey(org.id, user.id), 'complete')
    const url = new URL(window.location.href)
    if (url.searchParams.has('tutorialSprint')) {
      url.searchParams.delete('tutorialSprint')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    setOpen(false)
    setStep(0)
    setError('')
    setTargetRect(null)
  }, [org.id, user.id])

  useEffect(() => {
    const start = () => {
      setContext(null)
      setStep(0)
      setError('')
      setOpen(true)
    }
    window.addEventListener('connectio:start-product-tour', start)
    const params = new URLSearchParams(location.search)
    if (params.get('tour') === '1') {
      start()
      params.delete('tour')
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true })
    }
    return () => window.removeEventListener('connectio:start-product-tour', start)
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!open || step === 0 || step === LAST_STEP + 1 || navigationRef.current) return
    const expected = expectedLocation(step, org.slug, context)
    if (expected && location.pathname !== expected) {
      const timer = window.setTimeout(() => close(false), 0)
      return () => window.clearTimeout(timer)
    }
  }, [close, context, location.pathname, open, org.slug, step])

  useEffect(() => {
    if (!open) return
    const taskCreated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string; taskId: string }>).detail
      if (step !== 8 || !context || detail.projectId !== context.projectId) return
      setContext({ ...context, taskId: detail.taskId })
      setStep(9)
    }
    const composerOpened = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string }>).detail
      if (step === 7 && context && detail.projectId === context.projectId) setStep(8)
    }
    const taskOpened = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId: string }>).detail
      if (step === 9 && context?.taskId === detail.taskId) setStep(10)
    }
    window.addEventListener('connectio:tutorial-composer-opened', composerOpened)
    window.addEventListener('connectio:tutorial-task-created', taskCreated)
    window.addEventListener('connectio:tutorial-task-opened', taskOpened)
    return () => {
      window.removeEventListener('connectio:tutorial-composer-opened', composerOpened)
      window.removeEventListener('connectio:tutorial-task-created', taskCreated)
      window.removeEventListener('connectio:tutorial-task-opened', taskOpened)
    }
  }, [context, open, step])

  useEffect(() => {
    if (!open || !current.target) {
      const timer = window.setTimeout(() => setTargetRect(null), 0)
      return () => window.clearTimeout(timer)
    }
    let target: HTMLElement | null = null
    let resizeObserver: ResizeObserver | null = null
    let scrollTimer = 0
    const update = () => {
      const next = document.querySelector<HTMLElement>(current.target!)
      if (next !== target) {
        resizeObserver?.disconnect()
        target = next
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          resizeObserver = new ResizeObserver(update)
          resizeObserver.observe(target)
        }
      }
      window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => setTargetRect(target?.getBoundingClientRect() ?? null), 40)
    }
    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    update()
    return () => {
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.clearTimeout(scrollTimer)
    }
  }, [current.target, location.pathname, location.search, open])

  useEffect(() => {
    if (open && !current.target) headingRef.current?.focus()
  }, [current.target, open, step])

  async function prepare() {
    setPreparing(true)
    setError('')
    try {
      let workspace = await db.workspaces.where('orgId').equals(org.id).first()
      if (!workspace) throw new Error('Create a workspace before starting the product tutorial.')

      let project = await db.projects.where('workspaceId').equals(workspace.id).first()
      if (!project) {
        if (membershipRole === 'member') throw new Error('Ask an owner or admin to create a project before starting this tutorial.')
        const preset = workspace.workflowPreset ?? 'general'
        project = {
          id: crypto.randomUUID(),
          orgId: org.id,
          workspaceId: workspace.id,
          name: 'Getting started',
          taskCodePrefix: projectCodePrefix('Getting started'),
          description: 'A real project created for the Connectio guided tutorial.',
          leadId: user.id,
          coordinatorId: user.id,
          workflowStages: stagesForPreset(preset),
          terminology: terminologyForPreset(preset),
          status: 'active',
          color: '#2563EB',
          createdAt: new Date().toISOString(),
        }
        await db.projects.add(project)
      }

      let sprint = await db.sprints.where('projectId').equals(project.id).filter((item) => item.status !== 'completed').first()
      if (!sprint) {
        if (membershipRole === 'member') throw new Error('Ask a project manager to create an active sprint before starting this tutorial.')
        const start = new Date()
        const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000)
        sprint = {
          id: crypto.randomUUID(),
          projectId: project.id,
          name: 'Getting started sprint',
          goal: 'Learn the task workflow with a real piece of work.',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          status: 'active',
        }
        await db.sprints.add(sprint)
      }

      const nextContext = { workspaceId: workspace.id, projectId: project.id, sprintId: sprint.id }
      setContext(nextContext)
      navigationRef.current = true
      setStep(1)
      navigate(`/app/${org.slug}/dashboard`)
      window.setTimeout(() => { navigationRef.current = false }, 0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tutorial could not be prepared.')
    } finally {
      setPreparing(false)
    }
  }

  function go(nextStep: number, to?: string) {
    navigationRef.current = true
    setStep(nextStep)
    if (to) navigate(to)
    window.setTimeout(() => { navigationRef.current = false }, 0)
  }

  function next() {
    if (step === 0) return void prepare()
    if (step === 1) return go(2, `/app/${org.slug}/workspaces`)
    if (step === 2 && context) return go(3, `/app/${org.slug}/workspaces/${context.workspaceId}`)
    if (step === 3 && context) return go(4, `/app/${org.slug}/projects/${context.projectId}`)
    if (step === 4 && context) return go(5, `/app/${org.slug}/projects/${context.projectId}?view=sprints`)
    if (step === 5 && context) return go(6, `/app/${org.slug}/projects/${context.projectId}?view=board&tutorialSprint=${context.sprintId}`)
    if (step === 6) return go(7)
    if (step === 9 && context?.taskId) {
      window.dispatchEvent(new CustomEvent('connectio:tutorial-open-task', { detail: { taskId: context.taskId } }))
      return
    }
    if (step === 10) return go(11)
    if (step === 11) close(true)
  }

  function previous() {
    if (step === 1) return go(0)
    if (step === 2) return go(1, `/app/${org.slug}/dashboard`)
    if (step === 3) return go(2, `/app/${org.slug}/workspaces`)
    if (step === 4 && context) return go(3, `/app/${org.slug}/workspaces/${context.workspaceId}`)
    if (step === 5 && context) return go(4, `/app/${org.slug}/projects/${context.projectId}`)
    if (step === 6 && context) return go(5, `/app/${org.slug}/projects/${context.projectId}?view=sprints`)
    if (step === 7) return go(6)
    if (step === 8) return go(7)
    if (step === 9) return go(8)
    if (step === 10) return go(9)
    if (step === 11) return go(10)
  }

  if (!open) return null

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const cardWidth = Math.min(368, viewportWidth - 32)
  const mobile = viewportWidth < 640
  const panelStyle: CSSProperties = mobile
    ? { left: 16, right: 16, bottom: 16 }
    : targetRect
      ? (() => {
          const gap = 18
          const maxTop = viewportHeight - 390
          if (viewportWidth - targetRect.right > cardWidth + gap) return { left: targetRect.right + gap, top: Math.max(16, Math.min(targetRect.top, maxTop)) }
          if (targetRect.left > cardWidth + gap) return { left: targetRect.left - cardWidth - gap, top: Math.max(16, Math.min(targetRect.top, maxTop)) }
          if (viewportHeight - targetRect.bottom > 330) return { left: Math.max(16, Math.min(targetRect.left, viewportWidth - cardWidth - 16)), top: targetRect.bottom + gap }
          if (targetRect.top > 330) return { left: Math.max(16, Math.min(targetRect.left, viewportWidth - cardWidth - 16)), bottom: viewportHeight - targetRect.top + gap }
          return { right: 16, bottom: 16 }
        })()
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  const padded = targetRect ? {
    top: Math.max(0, targetRect.top - 8),
    left: Math.max(0, targetRect.left - 8),
    right: Math.min(viewportWidth, targetRect.right + 8),
    bottom: Math.min(viewportHeight, targetRect.bottom + 8),
  } : null

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none" aria-live="polite">
      {padded ? (
        <>
          <div className="fixed left-0 right-0 top-0 bg-slate-950/55" style={{ height: padded.top }} />
          <div className="fixed left-0 bg-slate-950/55" style={{ top: padded.top, width: padded.left, height: padded.bottom - padded.top }} />
          <div className="fixed right-0 bg-slate-950/55" style={{ top: padded.top, left: padded.right, height: padded.bottom - padded.top }} />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-950/55" style={{ top: padded.bottom }} />
          <div className="fixed rounded-xl ring-2 ring-primary ring-offset-4 ring-offset-transparent" style={{ top: padded.top, left: padded.left, width: padded.right - padded.left, height: padded.bottom - padded.top }} />
        </>
      ) : <div className="fixed inset-0 bg-slate-950/55" />}

      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="product-tour-title"
        className="pointer-events-auto fixed w-[calc(100vw-2rem)] max-w-[23rem] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        style={panelStyle}
      >
        <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(8, (step / (LAST_STEP + 1)) * 100)}%` }} /></div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {step === 11 ? <Check aria-hidden="true" className="size-5" /> : <Sparkles aria-hidden="true" className="size-5" />}
            </div>
            <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 size-10" onClick={() => close(false)} aria-label="Skip tutorial">
              <X aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-primary">{current.eyebrow}</p>
          <h2 ref={headingRef} tabIndex={-1} id="product-tour-title" className="mt-1 text-lg font-bold tracking-tight text-foreground outline-none">{current.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.description}</p>
          {step === 0 && <p className="mt-3 rounded-lg bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">If your workspace has no project or sprint yet, the tutorial creates those real prerequisites after you start. It never creates the task for you.</p>}
          {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {current.waitingLabel && <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary"><span className="size-2 animate-pulse rounded-full bg-primary" />{current.waitingLabel}</p>}
          <div className="mt-5 flex items-center gap-2">
            {step > 0 && step < 11 && <Button type="button" variant="ghost" onClick={previous}><ArrowLeft aria-hidden="true" /> Back</Button>}
            <button type="button" className="ml-auto min-h-10 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => close(false)}>Skip tour</button>
            {current.actionLabel && (
              <Button type="button" onClick={next} disabled={preparing}>
                {preparing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : step === 11 ? <Check aria-hidden="true" /> : null}
                {current.actionLabel}
                {!preparing && step !== 11 && <ArrowRight aria-hidden="true" />}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
