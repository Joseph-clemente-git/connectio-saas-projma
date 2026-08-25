import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { calculateMilestoneDelivery, calculateMilestoneStatus } from '@/lib/schedule-health'

/** Keeps the stored milestone status and actual completion date in sync with linked delivery work. */
export function useMilestoneCompletion(projectId: string | undefined, finalStageId: string) {
  const snapshots = useLiveQuery(async () => {
    if (!projectId) return []
    const [milestones, sprints, tasks] = await Promise.all([
      db.milestones.where('projectId').equals(projectId).toArray(),
      db.sprints.where('projectId').equals(projectId).toArray(),
      db.tasks.where('projectId').equals(projectId).toArray(),
    ])
    return milestones.map((milestone) => ({
      milestone,
      delivery: calculateMilestoneDelivery(milestone.id, sprints, tasks, finalStageId),
    }))
  }, [finalStageId, projectId])

  useEffect(() => {
    if (!snapshots) return
    const now = new Date()
    void Promise.all(snapshots.map(async ({ milestone, delivery }) => {
      const status = calculateMilestoneStatus(milestone.dueDate, delivery.isComplete, now)
      const completedAt = delivery.isComplete ? milestone.completedAt ?? now.toISOString() : undefined
      if (milestone.status === status && milestone.completedAt === completedAt) return
      await db.milestones.update(milestone.id, { status, completedAt })
    }))
  }, [snapshots])
}
