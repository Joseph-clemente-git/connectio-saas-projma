import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MarketingLayout } from '@/layouts/marketing-layout'
import { TenantAppLayout } from '@/layouts/tenant-app-layout'
import { AdminLayout } from '@/layouts/admin-layout'
import { RequireAuth, RequireOrgOwner, AppRootRedirect } from '@/routes/guards'
import { LandingPage } from '@/pages/marketing/landing-page'
import { PricingPage } from '@/pages/marketing/pricing-page'
import { LoginPage } from '@/pages/auth/login-page'
import { RegisterPage } from '@/pages/auth/register-page'
import { VerifyEmailPage } from '@/pages/auth/verify-email-page'
import { InvitationPage } from '@/pages/auth/invitation-page'
import { ChangePasswordPage } from '@/pages/auth/change-password-page'
import { OnboardingPage } from '@/pages/onboarding/onboarding-page'
import { DashboardPage } from '@/pages/app/dashboard-page'
import { TeamsPage } from '@/pages/app/teams-page'
import { MembersPage } from '@/pages/app/members-page'
import { WorkspacesPage } from '@/pages/app/workspaces-page'
import { WorkspaceDetailPage } from '@/pages/app/workspace-detail-page'
import { ProjectDetailPage } from '@/pages/app/project-detail-page'
import { SettingsOrgPage } from '@/pages/app/settings-org-page'
import { CalendarPage } from '@/pages/app/calendar-page'
import { TicketsPage } from '@/pages/app/tickets-page'
import { TicketDetailPage } from '@/pages/app/ticket-detail-page'
import { SettingsBillingPage } from '@/pages/app/settings-billing-page'
import { SettingsApiPage } from '@/pages/app/settings-api-page'
import { SettingsWorkflowsPage } from '@/pages/app/settings-workflows-page'
import { ChatPage } from '@/pages/app/chat-page'
import { FilesPage } from '@/pages/app/files-page'
import { TicketPortalPage } from '@/pages/public/ticket-portal-page'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { OrganizationsPage } from '@/pages/admin/organizations-page'
import { OrganizationDetailPage } from '@/pages/admin/organization-detail-page'
import { PlansPage } from '@/pages/admin/plans-page'
import { UsersPage } from '@/pages/admin/users-page'
import { FeatureFlagsPage } from '@/pages/admin/feature-flags-page'
import { AdminSettingsPage } from '@/pages/admin/admin-settings-page'
import { BillingPage } from '@/pages/admin/billing-page'

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/pricing', element: <PricingPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify', element: <VerifyEmailPage /> },
  { path: '/invite/:token', element: <InvitationPage /> },
  { path: '/portal/:orgSlug/:projectId', element: <TicketPortalPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      { path: '/app', element: <AppRootRedirect /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        path: '/app/:orgSlug',
        element: <TenantAppLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'workspaces', element: <WorkspacesPage /> },
          { path: 'workspaces/:workspaceId', element: <WorkspaceDetailPage /> },
          { path: 'projects/:projectId', element: <ProjectDetailPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'tickets', element: <TicketsPage /> },
          { path: 'tickets/:ticketId', element: <TicketDetailPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'files', element: <FilesPage /> },
          { path: 'settings/org', element: <SettingsOrgPage /> },
          {
            element: <RequireOrgOwner />,
            children: [{ path: 'settings/billing', element: <SettingsBillingPage /> }],
          },
          { path: 'settings/api', element: <SettingsApiPage /> },
          { path: 'settings/workflows', element: <SettingsWorkflowsPage /> },
        ],
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'organizations', element: <OrganizationsPage /> },
          { path: 'organizations/:orgId', element: <OrganizationDetailPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'plans', element: <PlansPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'feature-flags', element: <FeatureFlagsPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
])
