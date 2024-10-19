import { SignUp } from '@clerk/clerk-react'

export default function SignUpPage() {
  return <SignUp path="/sign-up" signInUrl='/sign-in'/>
}