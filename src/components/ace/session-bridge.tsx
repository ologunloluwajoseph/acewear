'use client'

import { useEffect } from 'react'
import { installFetchInterceptor } from '@/lib/session-token'

/**
 * Invisible mount-point that installs the Bearer-token fetch interceptor
 * before any component fires /api/ calls (child effects run before parent
 * effects, so the interceptor is active before page.tsx's session
 * bootstrap fetch executes).
 */
export function SessionBridge() {
  useEffect(() => {
    installFetchInterceptor()
  }, [])
  return null
}
