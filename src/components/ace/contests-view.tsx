'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crown, Loader2, Plus, Trophy, Users, Vote as VoteIcon } from 'lucide-react'
import { toast as sonner } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { AceAvatar, MediaImg, UploadButton, countdown } from '@/components/ace/media'
import type { ContestDTO, EntryDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/client-store'

const PHASE_STYLES: Record<ContestDTO['phase'], string> = {
  upcoming: 'bg-sky-400/10 text-sky-400',
  active: 'bg-emerald-400/10 text-emerald-400',
  voting: 'bg-amber-400/10 text-amber-400',
  completed: 'bg-muted text-muted-foreground',
}

// ---------------- create contest (admin) ----------------

function CreateContestDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prize, setPrize] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [durationHours, setDurationHours] = useState(72)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!title.trim()) return sonner.error('Title required')
    setBusy(true)
    try {
      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, prize, coverUrl, durationHours }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Contest is live 🏆')
        setTitle(''); setDescription(''); setPrize(''); setCoverUrl(null)
        onOpenChange(false)
        onCreated()
      } else sonner.error(data.error ?? 'Failed to create contest')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create contest</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ct">Title</Label>
            <Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Golden Face of the Week" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd">Description</Label>
            <Textarea id="cd" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rules, theme, how voting works…" className="min-h-16" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp">Prize</Label>
              <Input id="cp" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="5,000 coins" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdur">Duration (hours)</Label>
              <Input id="cdur" type="number" min={1} max={720} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} />
            </div>
          </div>
          <UploadButton preset="contests" label="Cover (→ WebP)" onUploaded={(img) => setCoverUrl(img.url)} onError={(m) => sonner.error(m)} />
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- contest detail (entries + voting) ----------------

function ContestDetailDialog({
  contestId, open, onOpenChange, onChanged,
}: {
  contestId: number | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const me = useAppStore((s) => s.me)
  const [contest, setContest] = useState<ContestDTO | null>(null)
  const [entries, setEntries] = useState<EntryDTO[]>([])
  const [joinOpen, setJoinOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!contestId) return
    try {
      const res = await fetch(`/api/contests/${contestId}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) { setContest(data.contest); setEntries(data.entries) }
    } catch { /* offline */ }
  }, [contestId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const join = async () => {
    if (!caption.trim() || !imageUrl) return sonner.error('Caption + photo required')
    setBusy(true)
    try {
      const res = await fetch(`/api/contests/${contestId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, imageUrl }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        sonner.success('Entry submitted — rally your votes! 🎉')
        setJoinOpen(false); setCaption(''); setImageUrl(null)
        void load(); onChanged()
      } else sonner.error(data.error ?? 'Failed to join')
    } finally { setBusy(false) }
  }

  const vote = async (entry: EntryDTO) => {
    // optimistic
    setEntries((list) =>
      list.map((e) =>
        e.id === entry.id
          ? { ...e, votedByMe: !e.votedByMe, votesCount: e.votesCount + (e.votedByMe ? -1 : 1) }
          : e
      )
    )
    try {
      const res = await fetch(`/api/entries/${entry.id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setEntries((list) =>
          list
            .map((e) => (e.id === entry.id ? { ...e, votedByMe: data.voted, votesCount: data.votesCount } : e))
            .sort((a, b) => b.votesCount - a.votesCount)
        )
      } else {
        sonner.error(data.error ?? 'Vote failed')
        void load()
      }
    } catch { void load() }
  }

  const maxVotes = Math.max(1, ...entries.map((e) => e.votesCount))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {contest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {contest.title}
                  <Badge className={cn('border-0', PHASE_STYLES[contest.phase])}>{contest.phase}</Badge>
                </DialogTitle>
              </DialogHeader>
              {contest.coverUrl && (
                <MediaImg src={contest.coverUrl} alt="Contest cover" className="aspect-[1200/630] w-full rounded-xl object-cover" />
              )}
              <p className="text-sm text-muted-foreground">{contest.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-amber-400"><Trophy className="h-4 w-4" /> {contest.prize ?? '—'}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-4 w-4" /> {contest.entriesCount} entries</span>
                <span className="text-muted-foreground">
                  {contest.phase === 'active' ? `Entry closes ${countdown(contest.endsAt)}` : contest.phase === 'voting' ? `Voting closes ${countdown(contest.votingEndsAt)}` : '—'}
                </span>
              </div>

              {contest.winner && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <AceAvatar user={contest.winner} className="h-8 w-8" />
                  <span className="text-sm font-semibold">
                    {contest.winner.firstName ?? contest.winner.username} won this contest
                  </span>
                </div>
              )}

              {contest.phase === 'active' && !contest.joinedByMe && (
                <Button onClick={() => setJoinOpen(true)} className="w-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
                  <Plus className="mr-1 h-4 w-4" /> Enter contest
                </Button>
              )}

              <div className="space-y-3">
                <p className="text-sm font-semibold">Entries ({entries.length})</p>
                {entries.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No entries yet. Be the first!</p>
                )}
                {entries.map((e, i) => (
                  <div key={e.id} className="flex gap-3 rounded-xl border border-border p-3">
                    <span className="mt-1 w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    {e.imageUrl && <MediaImg src={e.imageUrl} alt={e.caption} className="h-16 w-16 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.caption}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AceAvatar user={e.user} className="mr-0.5 inline h-4 w-4" />
                        {e.user.firstName ?? e.user.username}
                        {e.user.isVerified ? ' ✓' : ''}
                      </p>
                      <Progress value={(e.votesCount / maxVotes) * 100} className="mt-2 h-1.5" />
                    </div>
                    <Button
                      variant={e.votedByMe ? 'default' : 'secondary'}
                      size="sm"
                      className={cn('shrink-0 self-center rounded-full', e.votedByMe && 'bg-gradient-to-r from-amber-400 to-amber-600 text-black')}
                      disabled={contest.phase === 'completed' || !me}
                      onClick={() => vote(e)}
                    >
                      <VoteIcon className="mr-1 h-3.5 w-3.5" />
                      {e.votesCount}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* join dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Enter the contest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {imageUrl ? (
              <MediaImg src={imageUrl} alt="Entry preview" className="max-h-60 w-full rounded-xl object-cover" />
            ) : (
              <UploadButton preset="contests" label="Upload entry photo (→ WebP)" onUploaded={(img) => setImageUrl(img.url)} onError={(m) => sonner.error(m)} className="w-full" />
            )}
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption for your entry…" maxLength={300} />
          </div>
          <DialogFooter>
            <Button onClick={join} disabled={busy || !imageUrl || !caption.trim()} className="rounded-full bg-gradient-to-r from-amber-400 to-amber-600 font-semibold text-black hover:from-amber-300 hover:to-amber-500">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Submit entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------- contests view ----------------

export function ContestsView() {
  const me = useAppStore((s) => s.me)
  const [contests, setContests] = useState<ContestDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/contests', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setContests(data.contests)
    } catch { sonner.error('Could not load contests') } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 30_000) // keep countdowns/lifecycle fresh
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Contests 🏆</h2>
        {me?.isAdmin && (
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New contest
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>
      ) : (
        contests.map((c) => (
          <button
            key={c.id}
            className="block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-amber-400/40"
            onClick={() => setDetailId(c.id)}
          >
            {c.coverUrl && (
              <div className="relative">
                <MediaImg src={c.coverUrl} alt={c.title} className="aspect-[1200/630] w-full object-cover" />
                <Badge className={cn('absolute left-3 top-3 border-0 capitalize', PHASE_STYLES[c.phase])}>{c.phase}</Badge>
                {c.tier !== 'weekly' && (
                  <Badge className="absolute right-3 top-3 border-0 bg-black/60 text-white capitalize">{c.tier}</Badge>
                )}
              </div>
            )}
            <div className="p-4">
              <p className="font-semibold">{c.title}</p>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 text-amber-400"><Trophy className="h-3.5 w-3.5" /> {c.prize ?? '—'}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.entriesCount}</span>
                <span className="flex items-center gap-1"><VoteIcon className="h-3.5 w-3.5" /> {c.totalVotes}</span>
                <span className="ml-auto">
                  {c.phase === 'active' && countdown(c.endsAt)}
                  {c.phase === 'voting' && `voting ${countdown(c.votingEndsAt)}`}
                  {c.phase === 'upcoming' && `starts ${countdown(c.startsAt).replace(' left', ' in ')}`}
                  {c.phase === 'completed' && (c.winner ? `won by ${c.winner.firstName ?? c.winner.username}` : 'completed')}
                </span>
                {c.joinedByMe && <Badge className="border-0 bg-emerald-400/10 text-emerald-400">entered</Badge>}
              </div>
            </div>
          </button>
        ))
      )}

      <ContestDetailDialog contestId={detailId} open={detailId !== null} onOpenChange={(v) => !v && setDetailId(null)} onChanged={load} />
      <CreateContestDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  )
}
