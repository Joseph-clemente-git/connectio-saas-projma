import { db } from '@/db/schema'
import type { OrganizationInvitation, User } from '@/types/domain'
import { recordBillingEvent } from '@/lib/billing-lifecycle'

const PASSWORD_ITERATIONS = 310_000
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000
const VERIFICATION_LIFETIME_MS = 15 * 60 * 1_000
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000
const encoder = new TextEncoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function randomToken(byteLength = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(byteLength)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

async function derivePasswordHash(password: string, salt: Uint8Array<ArrayBuffer>, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Include uppercase and lowercase letters.'
  if (!/\d/.test(password)) return 'Include at least one number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Include at least one symbol.'
  return null
}

export async function createCredential(userId: string, password: string, mustChangePassword = false): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const now = new Date().toISOString()
  await db.authCredentials.put({
    userId,
    passwordHash: await derivePasswordHash(password, salt),
    passwordSalt: bytesToBase64(salt),
    algorithm: 'PBKDF2-SHA256',
    iterations: PASSWORD_ITERATIONS,
    failedAttempts: 0,
    passwordChangedAt: now,
    mustChangePassword,
  })
}

async function issueVerificationCode(userId: string): Promise<string> {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  const now = Date.now()
  const existing = await db.verificationTokens.where('userId').equals(userId).toArray()
  await Promise.all(existing.filter((entry) => !entry.usedAt).map((entry) => db.verificationTokens.update(entry.id, { usedAt: new Date().toISOString() })))
  await db.verificationTokens.add({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await sha256(code),
    expiresAt: new Date(now + VERIFICATION_LIFETIME_MS).toISOString(),
    attempts: 0,
    createdAt: new Date(now).toISOString(),
  })
  return code
}

export interface RegistrationResult {
  user: User
  /** Returned only because this repository has no email delivery service. */
  developmentVerificationCode: string
}

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<RegistrationResult> {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (name.length < 2) throw new Error('Enter your full name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')
  const passwordError = validatePassword(input.password)
  if (passwordError) throw new Error(passwordError)
  if (await db.users.where('email').equals(email).first()) throw new Error('An account already exists for this email.')

  const user: User = {
    id: crypto.randomUUID(),
    name,
    email,
    avatarColor: '#2563EB',
    role: 'member',
    verificationStatus: 'pending',
    createdAt: new Date().toISOString(),
  }
  await db.users.add(user)
  const correlationId = crypto.randomUUID()
  try {
    await recordBillingEvent({
      correlationId, userId: user.id, event: 'registration.started', status: 'pending',
      message: 'Account registration started.',
    })
    await createCredential(user.id, input.password)
    const developmentVerificationCode = await issueVerificationCode(user.id)
    await recordBillingEvent({
      correlationId, userId: user.id, event: 'registration.completed', status: 'succeeded',
      message: 'Account registration completed; email verification is pending.',
    })
    return { user, developmentVerificationCode }
  } catch (cause) {
    await recordBillingEvent({
      correlationId, userId: user.id, event: 'registration.failed', status: 'failed',
      message: 'Account registration failed.',
    }).catch(() => undefined)
    const verificationTokenIds = await db.verificationTokens.where('userId').equals(user.id).primaryKeys()
    if (verificationTokenIds.length) await db.verificationTokens.bulkDelete(verificationTokenIds)
    await db.authCredentials.delete(user.id)
    await db.users.delete(user.id)
    throw cause
  }
}

export async function resendVerification(emailInput: string): Promise<string | null> {
  const user = await db.users.where('email').equals(normalizeEmail(emailInput)).first()
  if (!user || user.verificationStatus === 'verified') return null
  return issueVerificationCode(user.id)
}

export async function verifyEmail(emailInput: string, code: string): Promise<void> {
  const user = await db.users.where('email').equals(normalizeEmail(emailInput)).first()
  if (!user) throw new Error('The code is invalid or has expired.')
  if (user.verificationStatus === 'verified') return
  const tokens = await db.verificationTokens.where('userId').equals(user.id).reverse().sortBy('createdAt')
  const token = tokens.find((entry) => !entry.usedAt)
  if (!token || token.attempts >= 5 || Date.parse(token.expiresAt) <= Date.now()) throw new Error('The code is invalid or has expired.')
  if (!constantTimeEqual(await sha256(code.trim()), token.tokenHash)) {
    await db.verificationTokens.update(token.id, { attempts: token.attempts + 1 })
    throw new Error('The code is invalid or has expired.')
  }
  const now = new Date().toISOString()
  await db.transaction('rw', [db.users, db.verificationTokens, db.billingEvents], async () => {
    await db.verificationTokens.update(token.id, { usedAt: now })
    await db.users.update(user.id, { verificationStatus: 'verified', verifiedAt: now })
    await db.billingEvents.add({
      id: crypto.randomUUID(), correlationId: crypto.randomUUID(), userId: user.id,
      event: 'registration.email_verified', status: 'succeeded',
      message: 'Registration email verified.', createdAt: now,
    })
  })
}

export interface AuthenticatedSession {
  user: User
  token: string
  mustChangePassword: boolean
}

export async function authenticate(emailInput: string, password: string): Promise<AuthenticatedSession> {
  const user = await db.users.where('email').equals(normalizeEmail(emailInput)).first()
  const credential = user ? await db.authCredentials.get(user.id) : undefined
  const invalid = new Error('Invalid email or password.')
  if (!user || !credential) throw invalid
  if (credential.lockedUntil && Date.parse(credential.lockedUntil) > Date.now()) throw invalid
  const candidate = await derivePasswordHash(password, base64ToBytes(credential.passwordSalt), credential.iterations)
  if (!constantTimeEqual(candidate, credential.passwordHash)) {
    const attempts = credential.failedAttempts + 1
    await db.authCredentials.update(user.id, {
      failedAttempts: attempts,
      lockedUntil: attempts >= 5 ? new Date(Date.now() + 5 * 60 * 1_000).toISOString() : undefined,
    })
    throw invalid
  }
  if (user.verificationStatus !== 'verified') throw new Error('Verify your email before signing in.')

  const token = randomToken()
  const tokenHash = await sha256(token)
  const now = new Date()
  await db.transaction('rw', [db.authCredentials, db.authSessions], async () => {
    await db.authCredentials.update(user.id, { failedAttempts: 0, lockedUntil: undefined })
    await db.authSessions.add({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
    })
  })
  return { user, token, mustChangePassword: credential.mustChangePassword === true }
}

function createTemporaryPassword(): string {
  // Every generated password satisfies validatePassword() and uses a CSPRNG.
  return `C!${randomToken(15)}a9`
}

export interface ProvisionedMemberResult {
  user: User
  temporaryPassword?: string
  isNewAccount: boolean
  invitation: OrganizationInvitation
  token: string
}

/**
 * Creates a pending invitation. New accounts receive a one-time temporary
 * password, but membership is not granted until the invitation is accepted.
 */
export async function provisionInvitedMember(input: {
  orgId: string
  inviterId: string
  name: string
  email: string
  role: 'admin' | 'member'
  workspaceIds?: string[]
  canReview?: boolean
}): Promise<ProvisionedMemberResult> {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (name.length < 2) throw new Error('Enter the member\'s full name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.')

  const organization = await db.organizations.get(input.orgId)
  if (!organization) throw new Error('This organization no longer exists.')
  const inviter = await db.orgMembers.where('[orgId+userId]').equals([input.orgId, input.inviterId]).first()
  if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) throw new Error('You do not have permission to invite members.')

  const existingUser = await db.users.where('email').equals(email).first()
  if (existingUser && await db.orgMembers.where('[orgId+userId]').equals([input.orgId, existingUser.id]).first()) {
    throw new Error('This person is already a member.')
  }

  const now = new Date().toISOString()
  const user: User = existingUser ?? {
    id: crypto.randomUUID(),
    name,
    email,
    avatarColor: '#2563EB',
    role: 'member',
    verificationStatus: 'verified',
    verifiedAt: now,
    createdAt: now,
  }
  // The single-use invitation token is the invited person's first authentication
  // factor. Accepting it starts a restricted session that can only set a password.
  const provisionedUserId = user.id
  const temporaryPassword = existingUser ? undefined : createTemporaryPassword()

  if (!existingUser) {
    await db.users.add(user)
    try { await createCredential(user.id, temporaryPassword!, true) } catch (cause) {
      await db.users.delete(user.id)
      throw cause
    }
  }
  try {
    const result = await createInvitation({
      orgId: input.orgId, inviterId: input.inviterId, email, role: input.role,
      workspaceIds: input.workspaceIds, canReview: input.canReview,
    })
    await db.invitations.update(result.invitation.id, { provisionedUserId })
    return {
      user, temporaryPassword, isNewAccount: !existingUser, token: result.token,
      invitation: { ...result.invitation, provisionedUserId },
    }
  } catch (cause) {
    if (!existingUser) {
      await db.authCredentials.delete(user.id)
      await db.users.delete(user.id)
    }
    throw cause
  }
}

export async function replaceTemporaryPassword(input: {
  userId: string
  sessionToken: string
  password: string
}): Promise<void> {
  const passwordError = validatePassword(input.password)
  if (passwordError) throw new Error(passwordError)
  const user = await validateSession(input.sessionToken, input.userId)
  const credential = await db.authCredentials.get(input.userId)
  if (!user || !credential || !credential.mustChangePassword) throw new Error('This password-change request is no longer valid.')
  const candidate = await derivePasswordHash(input.password, base64ToBytes(credential.passwordSalt), credential.iterations)
  if (constantTimeEqual(candidate, credential.passwordHash)) throw new Error('Choose a password different from the temporary password.')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const currentTokenHash = await sha256(input.sessionToken)
  const passwordHash = await derivePasswordHash(input.password, salt)
  await db.transaction('rw', [db.authCredentials, db.authSessions], async () => {
    await db.authCredentials.update(input.userId, {
      passwordHash,
      passwordSalt: bytesToBase64(salt),
      iterations: PASSWORD_ITERATIONS,
      failedAttempts: 0,
      lockedUntil: undefined,
      passwordChangedAt: new Date().toISOString(),
      mustChangePassword: false,
    })
    const sessions = await db.authSessions.where('userId').equals(input.userId).toArray()
    await Promise.all(sessions.filter((session) => session.tokenHash !== currentTokenHash).map((session) => db.authSessions.delete(session.id)))
  })
}

export async function validateSession(token: string | null, expectedUserId: string | null): Promise<User | null> {
  if (!token || !expectedUserId) return null
  const tokenHash = await sha256(token)
  const session = await db.authSessions.where('userId').equals(expectedUserId).filter((entry) => entry.tokenHash === tokenHash).first()
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session) await db.authSessions.delete(session.id)
    return null
  }
  const user = await db.users.get(session.userId)
  if (!user || user.verificationStatus !== 'verified') return null
  if (Date.now() - Date.parse(session.lastSeenAt) > 5 * 60 * 1_000) {
    await db.authSessions.update(session.id, { lastSeenAt: new Date().toISOString() })
  }
  return user
}

export async function revokeSession(token: string | null, userId: string | null): Promise<void> {
  if (!token || !userId) return
  const tokenHash = await sha256(token)
  const sessions = await db.authSessions.where('userId').equals(userId).toArray()
  await Promise.all(sessions.filter((entry) => entry.tokenHash === tokenHash).map((entry) => db.authSessions.delete(entry.id)))
}

export async function createInvitation(input: {
  orgId: string
  inviterId: string
  email: string
  role: 'admin' | 'member'
  workspaceIds?: string[]
  canReview?: boolean
}): Promise<{ invitation: OrganizationInvitation; token: string }> {
  const targetEmail = normalizeEmail(input.email)
  if (!/^\S+@\S+\.\S+$/.test(targetEmail)) throw new Error('Enter a valid email address.')
  const existingUser = await db.users.where('email').equals(targetEmail).first()
  if (existingUser && await db.orgMembers.where('[orgId+userId]').equals([input.orgId, existingUser.id]).first()) {
    throw new Error('This person is already a member.')
  }
  const pending = await db.invitations.where('orgId').equals(input.orgId)
    .filter((entry) => entry.targetEmail === targetEmail && entry.status === 'pending' && Date.parse(entry.expiresAt) > Date.now())
    .first()
  if (pending) throw new Error('A pending invitation already exists for this email.')

  const token = randomToken()
  const now = new Date()
  const invitation: OrganizationInvitation = {
    id: crypto.randomUUID(),
    orgId: input.orgId,
    inviterId: input.inviterId,
    targetEmail,
    role: input.role,
    workspaceIds: input.workspaceIds ?? [],
    canReview: input.canReview,
    tokenHash: await sha256(token),
    expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString(),
    status: 'pending',
    createdAt: now.toISOString(),
  }
  await db.invitations.add(invitation)
  return { invitation, token }
}

export async function getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
  const tokenHash = await sha256(token)
  const invitation = await db.invitations.where('tokenHash').equals(tokenHash).first()
  if (!invitation) return null
  if (invitation.status === 'pending' && Date.parse(invitation.expiresAt) <= Date.now()) {
    await db.invitations.update(invitation.id, { status: 'expired' })
    return { ...invitation, status: 'expired' }
  }
  // Invitations created before passwordless acceptance did not store the invited
  // user id. Repair them on read so their link remains usable without a login.
  if (invitation.status === 'pending' && !invitation.provisionedUserId) {
    const invitedUser = await db.users.where('email').equals(invitation.targetEmail).first()
    if (invitedUser) {
      await db.invitations.update(invitation.id, { provisionedUserId: invitedUser.id })
      return { ...invitation, provisionedUserId: invitedUser.id }
    }
  }
  return invitation
}

export async function acceptInvitation(token: string, userId: string): Promise<string> {
  const invitation = await getInvitationByToken(token)
  const user = await db.users.get(userId)
  if (!invitation || invitation.status !== 'pending' || !user || user.verificationStatus !== 'verified') {
    throw new Error('This invitation is invalid or has expired.')
  }
  const organization = await db.organizations.get(invitation.orgId)
  if (!organization || organization.onboardingStep !== 'complete') throw new Error('The organization owner must complete setup before this invitation can be accepted.')
  if (user.email !== invitation.targetEmail) throw new Error(`Sign in as ${invitation.targetEmail} to accept this invitation.`)
  const existing = await db.orgMembers.where('[orgId+userId]').equals([invitation.orgId, userId]).first()
  const now = new Date().toISOString()
  await db.transaction('rw', [db.orgMembers, db.invitations], async () => {
    const currentInvitation = await db.invitations.get(invitation.id)
    if (!currentInvitation || currentInvitation.status !== 'pending') throw new Error('This invitation has already been used.')
    if (!existing) {
      await db.orgMembers.add({
        id: crypto.randomUUID(),
        orgId: invitation.orgId,
        userId,
        role: invitation.role,
        teamIds: [],
        workspaceIds: invitation.workspaceIds,
        canReview: invitation.canReview,
        joinedAt: now,
      })
    }
    await db.invitations.update(invitation.id, { status: 'accepted', acceptedByUserId: userId, acceptedAt: now })
  })
  return invitation.orgId
}

/** Accepts a new-account invitation using its single-use token and starts the
 * restricted session that must proceed to password replacement. */
export async function acceptProvisionedInvitation(token: string): Promise<AuthenticatedSession & { orgId: string }> {
  const invitation = await getInvitationByToken(token)
  if (!invitation || invitation.status !== 'pending' || !invitation.provisionedUserId) {
    throw new Error('This invitation is invalid or has expired.')
  }
  const user = await db.users.get(invitation.provisionedUserId)
  const credential = user ? await db.authCredentials.get(user.id) : undefined
  if (!user || !credential || user.email !== invitation.targetEmail) {
    throw new Error('This invitation is invalid or has expired.')
  }

  const orgId = await acceptInvitation(token, user.id)
  await db.authCredentials.update(user.id, { mustChangePassword: true })
  const sessionToken = randomToken()
  const now = new Date()
  await db.authSessions.add({
    id: crypto.randomUUID(), userId: user.id, tokenHash: await sha256(sessionToken),
    createdAt: now.toISOString(), lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
  })
  return { user, token: sessionToken, mustChangePassword: true, orgId }
}
