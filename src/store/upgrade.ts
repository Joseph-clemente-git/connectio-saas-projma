import { create } from 'zustand'
import type { PlanTier } from '@/types/domain'

interface UpgradeDialogState {
  open: boolean
  featureLabel: string
  requiredPlan: PlanTier
  openUpgrade: (featureLabel: string, requiredPlan: PlanTier) => void
  close: () => void
}

export const useUpgradeDialog = create<UpgradeDialogState>((set) => ({
  open: false,
  featureLabel: '',
  requiredPlan: 'pro',
  openUpgrade: (featureLabel, requiredPlan) => set({ open: true, featureLabel, requiredPlan }),
  close: () => set({ open: false }),
}))
