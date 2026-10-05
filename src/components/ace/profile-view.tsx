'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck, Ban, Coins, Flag, Flame, Loader2, LogOut, MessageSquare,
  MoreHorizontal, Pencil, Trophy, UserMinus, UserPlus, X,
} from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AceAvatar, MediaImg, UploadButton, formatCoins, timeAgo } from '@/components/ace/media'
import { ReportDialog } from '@/components/ace/feed-view'
import type { PostDTO, ProfileDTO } from '@/lib/types'
import { useAppStore } from '@/lib/client-store'
import { clearToken } from '@/lib/session-token'
import { cn } from '@/lib/utils'

// ---------------- profile content (shared for me + others) ----------------

function ProfileBody({
  profile,
  posts,
  isMe,
  coins,
  onOpenProfile,
}: {
  profile: ProfileDTO
  posts: PostDTO[]
  isMe: boolean
  coins?: number
  onOpenProfile?: (username: string) => void
}) {
  const setOpenChatUserId = useAppStore((s) => s.setOpenChatUserId)
  const setView = useAppStore((s) => s.setView)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const bumpFeedRefresh = useAppStore((s) => s.bumpFeedRefresh)
  const [following, setFollowing] = useState(profile.following)
  const [blocked, setBlocked] = useState(Boolean(profile.blockedByMe))
  const [reportOpen, setReportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const toggleFollow = async () => {
    setFollowing(!following)
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      })
      const data = await res.json()
      if (res.ok && data.ok) setFollowing(data.following)
      else { setFollowing(following); sonner.error(data.error ?? 'Failed') }
    } catch { setFollowing(following) }
  }

  const toggleBlock = async () => {
    const next = !blocked
    setBlocked(next)
    try {
      const res = await fetch('/api/block', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success(next ? `Blocked @${profile.username}` : `Unblocked @${profile.username}`)
      } else {
        setBlocked(!next)
        sonner.error(data.error ?? 'Failed')
      }
    } catch {
      setBlocked(!next)
    }
  }

  const messageUser = () => {
    setOpenChatUserId(profile.id)
    setView('messages')
  }

  return (
    <div>
      {/* cover */}
      <div className="relative h-40 w-full sm:h-52">
        {profile.coverUrl ? (
          <MediaImg src={profile.coverUrl} alt="Profile cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-amber-500/30 via-fuchsia-500/20 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between">
          <div className="rounded-full border-4 border-background">
            <AceAvatar user={profile} className="h-24 w-24 text-3xl" />
          </div>
          <div className="mb-1 flex gap-2">
            {isMe ? (
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
            ) : blocked ? (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                data-testid="profile-unblock"
                onClick={toggleBlock}
              >
                <Ban className="mr-1 h-4 w-4" /> Unblock
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={following ? 'secondary' : 'default'}
                  className={cn('rounded-full', !following && 'bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500')}
                  onClick={toggleFollow}
                >
                  {following ? <><UserMinus className="mr-1 h-4 w-4" /> Unfollow</> : <><UserPlus className="mr-1 h-4 w-4" /> Follow</>}
                </Button>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={messageUser}>
                  <MessageSquare className="mr-1 h-4 w-4" /> Message
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground"
                      aria-label="Profile options"
                      data-testid="profile-options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => setReportOpen(true)} data-testid="profile-report">
                      <Flag className="mr-2 h-4 w-4 text-amber-400" /> Report profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={toggleBlock}
                      className="text-destructive focus:text-destructive"
                      data-testid="profile-block"
                    >
                      <Ban className="mr-2 h-4 w-4" /> Block @{profile.username}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h2 className="flex items-center gap-1.5 text-xl font-bold">
            {profile.firstName ?? profile.username}
            {profile.isVerified && <BadgeCheck className="h-5 w-5 text-amber-400" />}
            {profile.isPro && <Badge className="border-0 bg-amber-400/15 text-[10px] font-bold text-amber-400">PRO</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span><b>{profile._count.posts}</b> <span className="text-muted-foreground">posts</span></span>
            <span><b>{profile._count.followers}</b> <span className="text-muted-foreground">followers</span></span>
            <span><b>{profile._count.following}</b> <span className="text-muted-foreground">following</span></span>
            <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-400" /> <b>{profile._count.contestsWon}</b> <span className="text-muted-foreground">wins</span></span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3 text-amber-400" /> {profile.streakCount} day streak</Badge>
            <Badge variant="secondary" className="gap-1"><Coins className="h-3 w-3 text-amber-400" /> {formatCoins(coins ?? 0)} coins</Badge>
            <Badge variant="secondary">joined {timeAgo(profile.createdAt)}</Badge>
          </div>
        </div>

        {/* posts grid */}
        <div className="mb-6 mt-5">
          <p className="mb-2 text-sm font-semibold">Posts</p>
          {posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((p) => (
                <button
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                  onClick={() => onOpenProfile?.(profile.username)}
                >
                  {p.mediaUrl ? (
                    <MediaImg src={p.mediaUrl} alt={p.body ?? 'Post'} className="h-full w-full object-cover" />
                  ) : (
                    <p className="line-clamp-4 p-2 text-left text-xs text-muted-foreground">{p.body}</p>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">♥ {p.likesCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} onSaved={() => { void refreshMe(); bumpFeedRefresh() }} />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="user"
        targetId={profile.id}
        label={`@${profile.username}`}
      />
    </div>
  )
}

// ---------------- edit profile ----------------

function EditProfileDialog({
  open, onOpenChange, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const me = useAppStore((s) => s.me)
  const [firstName, setFirstName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && me) {
      setFirstName(me.firstName ?? '')
      setBio(me.bio ?? '')
      setAvatarUrl(me.avatarUrl)
      setCoverUrl(me.coverUrl)
    }
  }, [open, me])

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, bio, avatarUrl, coverUrl }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Profile updated ✓')
        onOpenChange(false)
        onSaved()
      } else sonner.error(data.error ?? 'Failed to save')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cover</Label>
            {coverUrl ? (
              <div className="relative">
                <MediaImg src={coverUrl} alt="Cover preview" className="h-24 w-full rounded-xl object-cover" />
                <Button variant="secondary" size="icon" className="absolute right-2 top-2 h-7 w-7 rounded-full" onClick={() => setCoverUrl(null)} aria-label="Remove cover"><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <UploadButton preset="covers" label="Upload cover (→ WebP)" onUploaded={(img) => setCoverUrl(img.url)} onError={(m) => sonner.error(m)} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex items-center gap-3">
              <AceAvatar user={{ username: me?.username ?? '?', avatarUrl }} className="h-14 w-14" />
              <UploadButton preset="avatars" label="Upload avatar (→ WebP)" onUploaded={(img) => setAvatarUrl(img.url)} onError={(m) => sonner.error(m)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Display name</Label>
            <Input id="pf-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio">Bio</Label>
            <Textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} className="min-h-16" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- other-user dialog ----------------

export function UserProfileDialog({
  username, open, onOpenChange,
}: {
  username: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [profile, setProfile] = useState<ProfileDTO | null>(null)
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !username) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/${username}`, { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && data.ok) {
          setProfile(data.profile)
          setPosts(data.posts)
        }
      } catch {
        /* offline */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, username])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-lg">
        {loading || !profile ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
        ) : (
          <ProfileBody profile={profile} posts={posts} isMe={false} coins={0} />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------- own profile view ----------------

export function ProfileView({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const router = useRouter()
  const me = useAppStore((s) => s.me)
  const setMe = useAppStore((s) => s.setMe)
  const [profile, setProfile] = useState<ProfileDTO | null>(null)
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!me) return
    try {
      const res = await fetch(`/api/users/${me.username}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        // keep the richer session shape for coins
        setProfile({ ...data.profile, _count: { ...data.profile._count } })
        setPosts(data.posts)
      }
    } finally { setLoading(false) }
  }, [me])

  useEffect(() => { void load() }, [load])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    clearToken()
    setMe(null)
    router.refresh()
  }

  if (loading || !me) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
  }

  const enriched: ProfileDTO = (profile ?? {
    id: me.id,
    username: me.username,
    firstName: me.firstName,
    bio: me.bio,
    avatarUrl: me.avatarUrl,
    coverUrl: me.coverUrl,
    isVerified: me.isVerified,
    isPro: me.isPro,
    isAdmin: me.isAdmin,
    trustScore: me.trustScore,
    streakCount: me.streakCount,
    createdAt: String(me.createdAt),
    following: false,
    followedBy: false,
    _count: { posts: 0, followers: 0, following: 0, contestsWon: 0 },
  })

  return (
    <div>
      <div className="flex items-center justify-between p-4 pb-0">
        {me.isAdmin && (
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => useAppStore.getState().setView('admin')}>
            🛠 Admin panel
          </Button>
        )}
        <Button variant="ghost" size="sm" className="ml-auto rounded-full text-muted-foreground hover:text-destructive" onClick={logout}>
          <LogOut className="mr-1 h-4 w-4" /> Log out
        </Button>
      </div>
      <ProfileBody
        profile={enriched}
        posts={posts}
        isMe
        onOpenProfile={onOpenProfile}
        coins={me.aceCoins}
      />
    </div>
  )
}
