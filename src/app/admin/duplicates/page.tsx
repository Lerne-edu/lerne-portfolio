import { revalidatePath } from 'next/cache'
import { flash } from '@/lib/flash'
import { requireAdmin } from '@/lib/guards'
import { audit } from '@/lib/audit'
import { attachRow } from '@/lib/enrol'
import AdminNav from '@/components/AdminNav'

async function resolve(formData: FormData) {
  'use server'
  const supabase = await requireAdmin()
  const id = String(formData.get('id'))
  const choice = String(formData.get('choice')) // same | different | dismiss
  const { data: f } = await supabase.from('duplicate_flags').select('candidate_student_id, submitted').eq('id', id).single()
  if (!f) return flash('That item is no longer there.', 'error')
  const sub = f.submitted as any
  if (sub?.row && choice === 'same') {
    await attachRow(supabase, f.candidate_student_id, sub.row, sub.school_id, sub.year)
  } else if (sub?.row && choice === 'different') {
    const { data } = await supabase.rpc('create_or_link_student', { p_name: sub.name, p_dob: sub.dob, p_parent_name: sub.parent, p_birth_cert: sub.row?.birth_cert_no || null, p_pen: sub.row?.pen || null, p_force: true })
    if (data?.student_id) await attachRow(supabase, data.student_id, sub.row, sub.school_id, sub.year)
  }
  await supabase.from('duplicate_flags').update({ resolved: true }).eq('id', id)
  await audit(supabase, `duplicate_${choice}`, 'duplicate_flags', id)
  await flash('Done.')
  revalidatePath('/admin/duplicates')
}

export default async function Duplicates() {
  const supabase = await requireAdmin()
  const { data: flags } = await supabase.from('duplicate_flags')
    .select('id, submitted, students(full_name, dob, lerne_id)').eq('resolved', false).order('created_at')
  return (
    <main className="mx-auto max-w-3xl p-6">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-semibold">Possible duplicates ({flags?.length ?? 0})</h1>
      {(flags ?? []).map((f: any) => (
        <form key={f.id} action={resolve} className="mb-4 rounded border p-4 text-sm">
          <input type="hidden" name="id" value={f.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="font-medium">Already in Lerne</div>{f.students?.full_name}<br />{f.students?.dob} · {f.students?.lerne_id}</div>
            <div><div className="font-medium">New on a school list</div>{f.submitted?.name}<br />{f.submitted?.dob} · parent {f.submitted?.parent}</div>
          </div>
          {!f.submitted?.row && <p className="mt-2 text-amber-700">Older flag with no saved row: dismiss it and upload the student again if needed.</p>}
          <div className="mt-3 flex gap-2">
            {f.submitted?.row && <button name="choice" value="same" className="rounded bg-green-600 px-3 py-1 text-white">Same student: link</button>}
            {f.submitted?.row && <button name="choice" value="different" className="rounded border px-3 py-1">Different student: create new ID</button>}
            <button name="choice" value="dismiss" className="rounded border px-3 py-1 text-gray-600">Dismiss</button>
          </div>
        </form>
      ))}
      {(flags ?? []).length === 0 && <p className="text-gray-500">Nothing to review.</p>}
    </main>
  )
}
