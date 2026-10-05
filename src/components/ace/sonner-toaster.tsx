'use client'

import { Toaster as Sonner } from 'sonner'

// Rich toast host for realtime + action feedback (used via sonner imperative API)
export function SonnerToaster() {
  return (
    <Sonner
      position="top-center"
      theme="dark"
      toastOptions={{
        style: {
          background: 'oklch(0.17 0.012 285)',
          border: '1px solid oklch(0.26 0.015 285)',
          color: 'oklch(0.93 0.005 285)',
        },
      }}
    />
  )
}
