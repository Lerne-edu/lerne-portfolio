import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function link() {
  'use server'
  const supabase = await createClient()
  const { data: code } = await supabase.rpc('create_getprofily_link')
  if (code) (await cookies()).set('gp_code', code, { maxAge: 120, httpOnly: true, secure: true, sameSite: 'strict' })
  redirect('/getprofily')
}

async function revoke() {
  'use server'
  const supabase = await createClient()
  await supabase.rpc('revoke_getprofily_link')
  redirect('/getprofily')
}

export default async function Getprofily() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'student') redirect('/')
  const { data: eligible } = await supabase.rpc('getprofily_eligible')
  const adult = !!eligible
  const code = (await cookies()).get('gp_code')?.value

  return (
    <main className="mx-auto max-w-xl p-6">
      <a href="/records" className="text-sm text-blue-600 underline">Back to records</a>
      <h1 className="my-4 text-2xl font-semibold">Link my Lerne record to Getprofily</h1>
      {!adult ? (
        <p className="text-sm">Linking is available after Grade 12 or from age 18. Until then your parent manages your record.</p>
      ) : (
        <>
          <div className="mb-4 rounded border bg-amber-50 p-4 text-sm">
            <p className="mb-2 font-medium">What will be shared</p>
            <p>Your name, Lerne ID, and your verified achievements with their level, result, date and skill areas, marked &quot;Verified by Lerne&quot;.
              Contact details, unverified records and your private &quot;Areas to grow&quot; are never shared. Linking is optional and you can stop at any time.</p>
          </div>
          {code && (
            <div className="mb-4 rounded border p-4 text-sm">
              <p className="mb-1">Your link code (shown once; copy it into Getprofily now):</p>
              <code className="break-all font-mono">{code}</code>
            </div>
          )}
          <form action={link} className="mb-3"><button className="rounded bg-blue-600 px-4 py-2 text-white">I agree - create link code</button></form>
          <form action={revoke}><button className="text-sm text-red-600 underline">Stop sharing (revoke link)</button></form>
        </>
      )}
    </main>
  )
}
