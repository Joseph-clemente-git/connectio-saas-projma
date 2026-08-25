import { expect, test } from '@playwright/test'

test('owner onboarding and secure temporary-password member invite work without tenant seed data', async ({ page }) => {
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
  await expect(page.getByText('Member invited successfully')).toBeVisible()
  const loginUrl = await page.locator('#invited-login-url').inputValue()
  const temporaryPassword = await page.locator('#temporary-password').inputValue()
  expect(loginUrl).toContain('/login?email=')
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(12)

  await page.evaluate(() => localStorage.removeItem('connectio-session'))
  await page.goto(loginUrl)
  await page.locator('#login-password').fill(temporaryPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/change-password/)
  await page.getByLabel('New password', { exact: true }).fill('MemberSecure!2026')
  await page.getByLabel('Confirm new password').fill('MemberSecure!2026')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page).toHaveURL(/\/app\/lifecycle-studio\/dashboard/)
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
