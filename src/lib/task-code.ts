import type { Project, Task } from '@/types/domain'

const GENERIC_PROJECT_WORDS = new Set(['app', 'application', 'platform', 'portal', 'project', 'system'])

/** Builds a short, readable project key for human-facing work-item codes. */
export function projectCodePrefix(name: string) {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? []
  const meaningfulWords = words.filter((word) => !GENERIC_PROJECT_WORDS.has(word.toLowerCase()))
  const source = meaningfulWords.length ? meaningfulWords : words

  if (!source.length) return 'WORK'
  if (source.length === 1) return source[0].slice(0, 5)
  return source.slice(0, 5).map((word) => word[0]).join('')
}

export function formatTaskCode(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(3, '0')}`
}

export function nextTaskSequence(tasks: Pick<Task, 'code'>[]) {
  return tasks.reduce((highest, task) => {
    const sequence = task.code?.match(/-(\d+)$/)?.[1]
    return sequence ? Math.max(highest, Number(sequence)) : highest
  }, tasks.length) + 1
}

export function nextTaskCode(project: Pick<Project, 'name' | 'taskCodePrefix'>, tasks: Pick<Task, 'code'>[], offset = 0) {
  const prefix = project.taskCodePrefix ?? projectCodePrefix(project.name)
  return formatTaskCode(prefix, nextTaskSequence(tasks) + offset)
}

export function displayTaskCode(task: Pick<Task, 'code' | 'order'>, project: Pick<Project, 'name' | 'taskCodePrefix'>) {
  if (task.code) return task.code
  const prefix = project.taskCodePrefix ?? projectCodePrefix(project.name)
  return formatTaskCode(prefix, task.order + 1)
}
