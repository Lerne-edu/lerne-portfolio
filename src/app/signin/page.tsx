import { redirect } from 'next/navigation'

// "Sign in" opens the parent sign-in; the tabs on that page switch to student or school sign-in.
export default function SignIn() {
  redirect('/parent-login')
}
