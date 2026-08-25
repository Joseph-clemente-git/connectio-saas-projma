import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID } from '@/types/domain'
import { revokeSession } from '@/lib/auth'

interface SessionState {
  userId: ID | null
  orgId: ID | null
  sessionToken: string | null
  isAuthenticated: boolean
  signIn: (userId: ID, orgId: ID | null, sessionToken: string) => void
  switchOrg: (orgId: ID) => void
  signOut: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      orgId: null,
      sessionToken: null,
      isAuthenticated: false,
      signIn: (userId, orgId, sessionToken) => set({ userId, orgId, sessionToken, isAuthenticated: true }),
      switchOrg: (orgId) => set({ orgId }),
      signOut: () => set((state) => {
        void revokeSession(state.sessionToken, state.userId)
        return { userId: null, orgId: null, sessionToken: null, isAuthenticated: false }
      }),
    }),
    { name: 'connectio-session' },
  ),
)
