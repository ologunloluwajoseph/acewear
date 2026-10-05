import { Suspense } from 'react'
import { VerifyEmailClient } from './verify-client'

export const metadata = { title: 'Verify email — ACE' }

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <VerifyEmailClient />
    </Suspense>
  )
}
