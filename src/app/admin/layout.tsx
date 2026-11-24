import AdminSidebar from '@/components/AdminSidebar'
import { requireAdmin } from '@/lib/guards'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin() // anyone who is not a Lerne admin is sent home before any admin menu or page is drawn
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">{children}</div>
    </div>
  )
}