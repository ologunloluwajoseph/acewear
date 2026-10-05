import { Suspense } from 'react'
import { ResetPasswordClient } from './reset-client'

export const metadata = { title: 'Reset password — ACE' }

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ResetPasswordClient />
    </Suspense>
  )
}
