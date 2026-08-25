import { expect, test } from '@playwright/test'

test('invitation acceptance forces a new member to create a private password', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('http://127.0.0.1:5173/register')
  await page.getByLabel('Full name').fill('Lifecycle Owner')
  await page.getByLabel('Email address').fill('owner@lifecycle.test')
  await page.getByLabel('Password', { exact: true }).fill('Lifecycle!2026')
  await page.getByLabel('Confirm password').fill('Lifecycle!2026')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
  const ownerCode = await page.locator('strong.font-mono').textContent()
  await page.getByLabel('Verification code').fill(ownerCode ?? '')
  await page.getByRole('button', { name: 'Verify email' }).click()

  await page.locator('#login-password').fill('Lifecycle!2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Build your clean workspace' })).toBeVisible()

  await page.getByLabel('Organization name').fill('Lifecycle Studio')
  await page.getByLabel(/Industry/).fill('Product design')
  await page.getByRole('button', { name: 'Create organization' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a plan' })).toBeVisible()
  await page.getByRole('button', { name: 'Select Pro' }).click()

  await page.getByLabel('Workspace name').fill('Client Delivery')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect(page).toHaveURL(/\/app\/lifecycle-studio\/dashboard/)

  await page.getByRole('link', { name: 'Plan & billing' }).click()
  await page.getByRole('tab', { name: /Activity/ }).click()
  await expect(page.getByText('Account registration completed; email verification is pending.')).toBeVisible()
  await expect(page.getByText(/Payment is required for INV-/)).toBeVisible()
  await expect(page.getByText('Organization onboarding completed.')).toBeVisible()

  await page.getByRole('link', { name: 'Members' }).click()
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByLabel('Full name').fill('Invited Member')
  await page.getByLabel('Email').fill('member@lifecycle.test')
  await page.getByRole('button', { name: 'Invite member', exact: true }).click()
  await expect(page.getByText('Invitation ready to share')).toBeVisible()
  const invitationUrl = await page.locator('#invitation-url').inputValue()
  const temporaryPassword = await page.locator('#temporary-password').inputValue()
  expect(invitationUrl).toContain('/invite/')
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(12)

  // Simulate an invitation created before passwordless acceptance stored the
  // invited user id. Opening the link must repair it instead of asking to log in.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('connectio')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('invitations', 'readwrite')
    const store = transaction.objectStore('invitations')
    const invitations = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const invitation = invitations.find((entry) => entry.targetEmail === 'member@lifecycle.test')
    if (invitation) {
      delete invitation.provisionedUserId
      store.put(invitation)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  })

  await page.goto(invitationUrl)
  await expect(page.getByRole('heading', { name: 'Join Lifecycle Studio' })).toBeVisible()
  await expect(page.getByText('No sign-in is required.')).toBeVisible()
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page).toHaveURL(/\/change-password/)
  await page.getByLabel('New password', { exact: true }).fill('MemberSecure!2026')
  await page.getByLabel('Confirm new password').fill('MemberSecure!2026')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page).toHaveURL(/\/app\/lifecycle-studio\/dashboard/)

  await page.goto(invitationUrl)
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible()
})

test('seeded Super Admin bypasses tenant onboarding', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/login')
  await page.getByLabel('Email address').fill('admin@connectio.app')
  await page.locator('#login-password').fill('ConnectioAdmin!2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Super Admin dashboard' })).toBeVisible()
})

test('authentication remains usable at phone and landscape widths with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }
})
