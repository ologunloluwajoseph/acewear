// =====================================================================
// ACE themes — light / dark / purple / premium(transparent, PRO only)
// Persisted in localStorage; applied via <html data-theme="…">.
// SSR default is "dark" (set in layout.tsx) so there is no flash.
// =====================================================================

export type ThemeId = 'light' | 'dark' | 'purple' | 'premium'

export const THEME_STORAGE_KEY = 'ace-theme'

export interface ThemeMeta {
  id: ThemeId
  label: string
  hint: string
  premium: boolean
  /** two-stop gradient preview shown on the swatch button */
  swatch: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'light',
    label: 'Light',
    hint: 'Daylight deck',
    premium: false,
    swatch: 'linear-gradient(135deg, #fdf6e3, #f0b429)',
  },
  {
    id: 'dark',
    label: 'Dark',
    hint: 'Classic casino',
    premium: false,
    swatch: 'linear-gradient(135deg, #26262e, #0f0f14)',
  },
  {
    id: 'purple',
    label: 'Purple',
    hint: 'Royal flush',
    premium: false,
    swatch: 'linear-gradient(135deg, #a855f7, #3b0764)',
  },
  {
    id: 'premium',
    label: 'Transparent',
    hint: 'PRO black & white glass — floating aces ♠ ♥ ♦ ♣',
    premium: true,
    swatch: 'linear-gradient(135deg, #fafafa, #17171c 52%, #a855f7)',
  },
]

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'light' || value === 'dark' || value === 'purple' || value === 'premium'
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark'
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeId(v) ? v : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* private mode — theme applies for this session only */
  }
}

// =====================================================================
// Premium eligibility — PRO members, admins, and the 3-day free trial
// ---------------------------------------------------------------------
// Every new account gets ALL premium features free for the first 3 days
// since it was created (the "welcome trial"). The trial clock is derived
// from the user's createdAt, so it survives logins/devices and cannot be
// reset. Works with both server Dates and ISO strings from JSON.
// =====================================================================

export const TRIAL_MS = 3 * 24 * 60 * 60 * 1000

export interface PremiumUser {
  isPro?: boolean
  isAdmin?: boolean
  /** PRO plan purchased via Paystack — monthly | yearly | lifetime */
  proPlan?: string | null
  /** When a paid PRO period ends (null/undefined = forever). Survives JSON as ISO string. */
  proUntil?: string | number | Date | null
  createdAt?: string | number | Date | null
}

/** When the user's free trial ends, or null if they have no trial window. */
export function trialEndsAt(user: PremiumUser | null): Date | null {
  if (!user?.createdAt) return null
  const created = new Date(user.createdAt).getTime()
  if (!Number.isFinite(created)) return null
  return new Date(created + TRIAL_MS)
}

/** Milliseconds left in the free trial (0 when expired or non-applicable). */
export function trialRemainingMs(user: PremiumUser | null): number {
  const end = trialEndsAt(user)
  return end ? Math.max(0, end.getTime() - Date.now()) : 0
}

/** Whether a paid PRO entitlement (isPro / admin) is active right now. */
export function proEntitlementActive(user: PremiumUser | null): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  if (!user.isPro) return false
  if (user.proUntil == null) return true // lifetime
  const until = new Date(user.proUntil).getTime()
  return Number.isFinite(until) && until > Date.now()
}

/** Whether the user can use premium features right now. */
export function canUsePremium(user: PremiumUser | null): boolean {
  if (proEntitlementActive(user)) return true
  return trialRemainingMs(user) > 0
}

/** 'member' = paying PRO (or admin), 'trial' = inside the 3-day window, 'free'. */
export function premiumTier(user: PremiumUser | null): 'member' | 'trial' | 'free' {
  if (proEntitlementActive(user)) return 'member'
  return trialRemainingMs(user) > 0 ? 'trial' : 'free'
}

// =====================================================================
// Per-theme brightness / darkness adjustment
// ---------------------------------------------------------------------
// Every theme can be fine-tuned between 50% (much darker) and 150%
// (much brighter). The level is remembered PER THEME in localStorage.
// It renders as a full-screen "veil": darkening paints a black veil,
// brightening a white one. A veil — unlike a CSS filter — never breaks
// position:fixed bars, sticky headers or backdrop-blur glass surfaces.
// =====================================================================

export const BRIGHTNESS_STORAGE_KEY = 'ace-theme-brightness'
export const MIN_BRIGHTNESS = 50
export const MAX_BRIGHTNESS = 150
export const DEFAULT_BRIGHTNESS = 100

export type BrightnessMap = Partial<Record<ThemeId, number>>

function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BRIGHTNESS
  return Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, Math.round(value)))
}

export function getStoredBrightnessMap(): BrightnessMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(BRIGHTNESS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as BrightnessMap
    const clean: BrightnessMap = {}
    for (const key of ['light', 'dark', 'purple', 'premium'] as const) {
      const v = parsed[key]
      if (typeof v === 'number') clean[key] = clampBrightness(v)
    }
    return clean
  } catch {
    return {}
  }
}

/** Saved brightness of one theme (100 when never adjusted). */
export function getStoredBrightness(theme: ThemeId): number {
  return getStoredBrightnessMap()[theme] ?? DEFAULT_BRIGHTNESS
}

function brightnessVeil(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  let el = document.getElementById('ace-brightness-veil') as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = 'ace-brightness-veil'
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;pointer-events:none;transition:background 180ms ease;'
    document.body.appendChild(el)
  }
  return el
}

/** Paint (or clear) the brightness veil for a theme level. */
export function applyBrightness(theme: ThemeId, value: number): void {
  const el = brightnessVeil()
  if (!el) return
  const v = clampBrightness(value)
  el.dataset.theme = theme
  if (v === DEFAULT_BRIGHTNESS) {
    el.style.background = 'transparent'
  } else if (v < DEFAULT_BRIGHTNESS) {
    // 50% → 0.40 black veil (nice and moody, never fully black)
    const darkness = ((DEFAULT_BRIGHTNESS - v) / 100) * 0.8
    el.style.background = `rgba(0, 0, 0, ${darkness.toFixed(3)})`
  } else {
    // 150% → 0.275 white veil (brighter screen, text stays readable)
    const brightness = ((v - DEFAULT_BRIGHTNESS) / 100) * 0.55
    el.style.background = `rgba(255, 255, 255, ${brightness.toFixed(3)})`
  }
}

/** Persist + apply the brightness level of one theme. */
export function setThemeBrightness(theme: ThemeId, value: number): void {
  const map = getStoredBrightnessMap()
  map[theme] = clampBrightness(value)
  try {
    window.localStorage.setItem(BRIGHTNESS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* private mode — level applies for this session only */
  }
  applyBrightness(theme, map[theme] as number)
}
