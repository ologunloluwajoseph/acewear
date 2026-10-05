'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// =====================================================================
// Deliverable 3: PWA Provider
// ---------------------------------------------------------------------
// 1. Registers the enhanced service worker (public/sw.js) and swaps in
//    new versions as soon as they finish installing.
// 2. Install banner (port of pwa-banner.js from the PHP app):
//      - re-checks eligibility every 15 seconds
//      - hidden while running standalone (already installed)
//      - dismissing starts a 7-day cooldown persisted in localStorage
//      - uses native beforeinstallprompt when available, with a graceful
//        iOS/menu fallback hint otherwise
// =====================================================================

const DISMISS_KEY = 'ace_pwa_dismissed_at'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CHECK_INTERVAL_MS = 15_000 // 15 seconds

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isDismissedRecently(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    return ts > 0 && Date.now() - ts < COOLDOWN_MS
  } catch {
    return false
  }
}

export function PwaProvider() {
  const [bannerVisible, setBannerVisible] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)
  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  // ---- service worker registration ----
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Dev: skip SW registration entirely. The sw.js stale-while-revalidate
    // strategy never updates entries that the dev server answers with a
    // 304 (ETag negotiation => response.ok === false => no cache.put), so
    // the worker would keep serving one-version-stale chunks while coding.
    // Production assets are content-hashed, so SWR is safe there.
    if (process.env.NODE_ENV !== 'production') return
    let registration: ServiceWorkerRegistration | null = null

    const onLoad = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
        // Activate waiting workers right away on reload
        registration.addEventListener('updatefound', () => {
          const worker = registration?.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage('SKIP_WAITING')
            }
          })
        })
      } catch {
        /* SW unsupported or blocked (e.g. sandboxed iframe) — non-fatal */
      }
    }

    if (document.readyState === 'complete') void onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // ---- capture native install prompt ----
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      promptEventRef.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => {
      setBannerVisible(false)
      promptEventRef.current = null
    })
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // ---- 15-second eligibility loop with 7-day cooldown ----
  useEffect(() => {
    const evaluate = () => {
      if (isStandalone()) return setBannerVisible(false)
      if (isDismissedRecently()) return setBannerVisible(false)
      setBannerVisible(true)
    }

    evaluate() // first check immediately on mount
    const interval = setInterval(evaluate, CHECK_INTERVAL_MS) // re-check every 15s
    return () => clearInterval(interval)
  }, [])

  const dismiss = () => {
    setBannerVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* private mode */
    }
  }

  const install = async () => {
    const promptEvent = promptEventRef.current
    if (promptEvent) {
      setInstalling(true)
      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        if (choice.outcome === 'accepted') setBannerVisible(false)
      } finally {
        setInstalling(false)
        promptEventRef.current = null
      }
      return
    }
    // No native prompt (iOS Safari / unsupported): show the manual hint
    setShowIosHint(true)
  }

  return (
    <>
      {/* iOS / fallback install hint */}
      <AnimatePresence>
        {showIosHint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-24 z-[55] mx-auto max-w-md px-4"
          >
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xl text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Install ACE</p>
              <p>
                iPhone/iPad: tap <span className="text-foreground">Share</span> ⇪
                then <span className="text-foreground">“Add to Home Screen”</span>.
                Android: menu ⋮ → <span className="text-foreground">Install app</span>.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setShowIosHint(false)
                  dismiss()
                }}
              >
                Got it
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom slide-up install banner */}
      <AnimatePresence>
        {bannerVisible && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] mx-auto w-full max-w-lg px-3"
            role="dialog"
            aria-label="Install ACE app"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-xl font-black text-black">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Install ACE</p>
                <p className="truncate text-xs text-muted-foreground">
                  Offline mode, instant loading & push-ready.
                </p>
              </div>
              <Button
                size="sm"
                onClick={install}
                disabled={installing}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500"
              >
                <Download className="mr-1 h-4 w-4" />
                Install
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={dismiss}
                aria-label="Dismiss install banner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
