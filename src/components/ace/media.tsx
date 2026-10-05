'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ---------- formatting helpers ----------

export function timeAgo(iso: string | Date): string {
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function countdown(iso: string | Date): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`
  if (h >= 1) return `${h}h ${m}m left`
  return `${m}m left`
}

export function formatCoins(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// ---------- avatar ----------

export function AceAvatar({
  user,
  className,
}: {
  user: { username: string; firstName?: string | null; avatarUrl?: string | null }
  className?: string
}) {
  const initial = (user.firstName ?? user.username ?? '?')[0]?.toUpperCase() ?? '?'
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.firstName ?? user.username}'s avatar`}
        className={cn('h-10 w-10 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-fuchsia-500 text-sm font-bold text-black',
        className
      )}
    >
      {initial}
    </div>
  )
}

// ---------- resilient media ----------

export function MediaImg({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.opacity = '0.25'
      }}
    />
  )
}

// ---------- WebP upload button (Deliverable 1 client side) ----------

interface UploadResult {
  url: string
  width: number
  height: number
  bytes: number
  originalBytes: number
  savedPercent: number
}

export function UploadButton({
  preset,
  onUploaded,
  onError,
  label = 'Photo',
  className,
  disabled,
  accept,
  busyLabel,
}: {
  preset: 'posts' | 'stories' | 'avatars' | 'covers' | 'contests' | 'products' | 'reels'
  onUploaded: (image: UploadResult & { mediaType?: 'video' | 'image' }) => void
  onError?: (message: string) => void
  label?: string
  className?: string
  disabled?: boolean
  accept?: string
  busyLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const upload = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('preset', preset)
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          onError?.(data.error ?? 'Upload failed')
        } else {
          onUploaded({ ...(data.image as UploadResult), mediaType: data.mediaType ?? 'image' })
        }
      } catch {
        onError?.('Upload failed — check your connection')
      } finally {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [preset, onUploaded, onError]
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? 'image/*'}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || disabled}
        className={cn('rounded-full', className)}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />}
        {busy ? (busyLabel ?? 'Compressing…') : label}
      </Button>
    </>
  )
}
