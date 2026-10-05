'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/client-store'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { AuthView } from '@/components/ace/auth-view'
import { AppShell } from '@/components/ace/app-shell'
import { SessionBridge } from '@/components/ace/session-bridge'
import { AceLeaves } from '@/components/ace/ace-leaves'

/**
 * The client-side SPA. Lives in its own component so that app/page.tsx
 * can stay a server component and generate per-post OpenGraph metadata
 * (link-preview pictures for shared post links).
 */
export function AceApp() {
  const me = useAppStore((s) => s.me)
  const setMe = useAppStore((s) => s.setMe)
  const setUnread = useAppStore((s) => s.setUnread)
  const [booting, setBooting] = useState(true)

  // Session bootstrap
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) {
          setMe(data.user)
          setUnread({
            unreadNotifications: data.unreadNotifications ?? 0,
            unreadMessages: data.unreadMessages ?? 0,
          })
        }
      })
      .catch(() => null)
      .finally(() => setBooting(false))
  }, [setMe, setUnread])

  return (
    <>
      {/* transparent-glass theme backdrop: hundreds of floating ace leaves */}
      <AceLeaves />
      {booting ? (
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-2xl font-black text-black">
              A
            </div>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-400" />
          </div>
        </div>
      ) : me ? (
        <AppShell />
      ) : (
        <AuthView
          onAuthenticated={(user) => {
            useAppStore.getState().setMe(user)
          }}
        />
      )}

      {/* Bearer-token fetch interceptor (iframe-preview cookie fallback) */}
      <SessionBridge />

      {/* Deliverable 3: service worker registration + install banner */}
      <PwaProvider />
    </>
  )
}
