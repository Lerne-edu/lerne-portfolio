'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS: [string, [string, string][]][] = [
  ['Review', [['/admin/queue', 'Verification queue'], ['/admin/duplicates', 'Duplicates'], ['/admin/requests', 'Data requests'], ['/admin/consents', 'Consents']]],
  ['People', [['/admin/students', 'Students'], ['/admin/schools', 'Schools'], ['/admin/school-admins', 'School admins'], ['/admin/invites', 'Parent invites']]],
  ['Data', [['/admin/upload', 'Upload students'], ['/admin/results', 'Upload results'], ['/admin/rollover', 'Yearly rollover'], ['/admin/moves', 'Moves'], ['/admin/certificates', 'Certificate QR']]],
  ['Engage', [['/admin/announce', 'Announce'], ['/admin/store', 'Store'], ['/admin/mentor', 'Mentor sessions'], ['/admin/summaries', 'AI summaries']]],
  ['System', [['/admin/audit', 'Audit log']]],
]

export default function AdminSidebar() {
  const path = usePathname()
  return (
    <aside className="admin-side" aria-label="Admin">
      <p className="admin-title">Lerne admin</p>
      {GROUPS.map(([group, items]) => (
        <div key={group} className="admin-group">
          <p>{group}</p>
          {items.map(([href, label]) => (
            <Link key={href} href={href} className={path === href || path.startsWith(href + '/') ? 'on' : ''}>{label}</Link>
          ))}
        </div>
      ))}
    </aside>
  )
}
