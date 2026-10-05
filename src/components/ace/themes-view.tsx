'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Check, Crown, Lock, Minus, Moon, Palette, Plus, RotateCcw, SlidersHorizontal, Sparkles, Sun,
} from 'lucide-react'
import { useAppStore } from '@/lib/client-store'
import {
  DEFAULT_BRIGHTNESS, MAX_BRIGHTNESS, MIN_BRIGHTNESS, THEMES, canUsePremium,
  getStoredBrightness, getStoredBrightnessMap, setThemeBrightness,
  type BrightnessMap, type ThemeId,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEME_ICON: Record<ThemeId, ReactNode> = {
  light: <Sun className="h-3.5 w-3.5" />,
  dark: <Moon className="h-3.5 w-3.5" />,
  purple: <span className="text-[11px] leading-none">♠</span>,
  premium: <Sparkles className="h-3.5 w-3.5" />,
}

const PRESETS = [
  { label: 'Dim', value: 65 },
  { label: 'Cozy', value: 85 },
  { label: 'Normal', value: 100 },
  { label: 'Bright', value: 120 },
  { label: 'Max', value: 140 },
]

// ---------------- Themes page — gallery + per-theme brightness ----------------

export function ThemesView({
  theme,
  onSelectTheme,
}: {
  theme: ThemeId
  onSelectTheme: (t: ThemeId) => void
}) {
  const me = useAppStore((s) => s.me)
  const setView = useAppStore((s) => s.setView)
  const premiumAllowed = canUsePremium(me)

  // SSR-safe lazy init — getStoredBrightness guards `typeof window`, and
  // the parent gives this component key={activeTheme}, so every theme
  // switch REMOUNTS the panel and re-reads storage fresh. No
  // setState-in-effect sync loop needed.
  const [brightness, setBrightness] = useState(() => getStoredBrightness(theme))
  const [saved, setSaved] = useState<BrightnessMap>(() => getStoredBrightnessMap())

  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[1]

  const changeBrightness = (value: number) => {
    const v = Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, Math.round(value)))
    setBrightness(v)
    setThemeBrightness(theme, v)
    setSaved((prev) => ({ ...prev, [theme]: v }))
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6" data-testid="themes-page">
      {/* header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
          <Palette className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black">Themes</h1>
          <p className="text-sm text-muted-foreground">
            Pick a look, then fine-tune how bright or dark it feels — saved per theme.
          </p>
        </div>
      </div>

      {/* theme gallery */}
      <section aria-label="Theme gallery" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const locked = t.premium && !premiumAllowed
          const active = theme === t.id
          const level = saved[t.id] ?? DEFAULT_BRIGHTNESS
          return (
            <div
              key={t.id}
              data-testid={`theme-card-${t.id}`}
              className={cn(
                'relative overflow-hidden rounded-2xl border transition',
                active ? 'border-amber-400/70 shadow-[0_0_0_2px_oklch(0.8_0.15_82/0.35)]' : 'border-border',
                locked && 'opacity-80'
              )}
            >
              <button
                type="button"
                onClick={() => onSelectTheme(t.id)}
                aria-pressed={active}
                aria-label={`${t.label} theme${locked ? ' (premium)' : ''}`}
                className="block w-full text-left"
              >
                <span
                  className="relative flex h-16 items-center justify-center border-b border-border/60"
                  style={{ background: t.swatch }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/15 text-white">
                    {THEME_ICON[t.id]}
                  </span>
                  {active && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  {locked && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      <Lock className="h-3 w-3" /> PRO
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {level}%
                  </span>
                </span>
              </button>
              {locked && (
                <button
                  type="button"
                  onClick={() => setView('premium')}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 bg-amber-400/10 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-400/20"
                >
                  <Crown className="h-3.5 w-3.5" /> Unlock with Premium
                </button>
              )}
            </div>
          )
        })}
      </section>

      {/* brightness & darkness tuner */}
      <section aria-label="Brightness and darkness" className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4 text-amber-400" /> Brightness &amp; Darkness
          </h2>
          <span data-testid="brightness-value" className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
            {brightness}%
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tuning <span className="font-semibold text-foreground">{activeTheme.label}</span> — every theme remembers its
          own level, from 50% (darkest) to 150% (brightest).
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Minus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            data-testid="brightness-slider"
            type="range"
            min={MIN_BRIGHTNESS}
            max={MAX_BRIGHTNESS}
            step={1}
            value={brightness}
            onChange={(e) => changeBrightness(Number(e.target.value))}
            aria-label={`Brightness of the ${activeTheme.label} theme`}
            aria-valuetext={`${brightness}% — ${brightness < 100 ? 'darker than normal' : brightness > 100 ? 'brighter than normal' : 'normal'}`}
            className="h-2 w-full cursor-pointer accent-amber-400"
          />
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Darker</span>
          <span>Normal</span>
          <span>Brighter</span>
        </div>

        {/* presets + reset */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              data-testid={`brightness-preset-${p.label.toLowerCase()}`}
              onClick={() => changeBrightness(p.value)}
              aria-pressed={brightness === p.value}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition',
                brightness === p.value
                  ? 'border-amber-400/70 bg-amber-400/10 text-amber-400'
                  : 'border-border text-muted-foreground hover:bg-accent/60'
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            data-testid="brightness-reset"
            onClick={() => changeBrightness(DEFAULT_BRIGHTNESS)}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-accent/60"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* per-theme saved levels */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saved level per theme</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`brightness-theme-${t.id}`}
                onClick={() => onSelectTheme(t.id)}
                className={cn(
                  'flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-xs transition',
                  theme === t.id ? 'border-amber-400/70 bg-amber-400/10' : 'border-border hover:bg-accent/60'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  {THEME_ICON[t.id]}
                  <span className="truncate font-semibold text-foreground">{t.label}</span>
                </span>
                <span className="shrink-0 font-bold text-amber-400">{saved[t.id] ?? DEFAULT_BRIGHTNESS}%</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
