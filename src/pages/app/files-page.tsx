import { useOutletContext } from 'react-router-dom'
import type { TenantOutletContext } from '@/layouts/tenant-app-layout'
import { PageHeader } from '@/components/shared/page-header'
import { FileExplorer } from '@/components/files/file-explorer'

export function FilesPage() {
  const { org, user, plan } = useOutletContext<TenantOutletContext>()
  return <div className="flex min-h-0 flex-1 flex-col"><PageHeader title="Files" description="Browse, search, and manage files across your organization." /><FileExplorer orgId={org.id} userId={user.id} plan={plan} title="Organization files" /></div>
}
