// =====================================================================
// ACE Shop — real-product marketplace (Task 16).
// The three official ACE stores. Clicking a product (or "Buy") sends the
// user to the vendor's website; the links arrive from the owner later,
// so `url` is intentionally null for now — set it and the whole UI goes
// live with zero code changes.
// =====================================================================

export interface ShopProduct {
  id: string
  name: string
  priceNaira: number
  blurb: string
  image: string
  tag?: string
}

export interface AceShop {
  id: string
  name: string
  tagline: string
  description: string
  emoji: string
  /** tailwind gradient for the store banner */
  gradient: string
  accent: string
  /** vendor website — drop the link here when it arrives */
  url: string | null
  products: ShopProduct[]
}

export const SHOPS: AceShop[] = [
  {
    id: 'acewears',
    name: 'AceWears',
    tagline: 'Wear the house colors',
    description:
      'Official ACE body wear — heavyweight hoodies, crisp tees, caps and joggers cut for the casino floor. Delivery nationwide.',
    emoji: '👕',
    gradient: 'from-neutral-900 via-neutral-800 to-purple-900/60',
    accent: 'text-purple-300',
    url: null, // ← AceWears store link lands here
    products: [
      {
        id: 'hoodie',
        name: 'Ace Signature Hoodie',
        priceNaira: 25000,
        blurb: 'Heavyweight 320gsm fleece with the purple A embroidered on the chest. Unisex fit, built to outlast streaks.',
        image: '/shop/acewears-hoodie.png',
        tag: 'Best seller',
      },
      {
        id: 'tee',
        name: 'Ace Classic Tee',
        priceNaira: 12000,
        blurb: '100% combed cotton, boxy cut, the every-day white tee with the clean purple A print.',
        image: '/shop/acewears-tee.png',
      },
      {
        id: 'cap',
        name: 'Ace Snapback Cap',
        priceNaira: 8000,
        blurb: 'Structured six-panel crown, adjustable snap closure, 3D embroidered A up front.',
        image: '/shop/acewears-cap.png',
      },
      {
        id: 'joggers',
        name: 'Ace Prime Joggers',
        priceNaira: 18000,
        blurb: 'Tapered athletic fit, zip pockets and a brushed interior — from the couch to the contest stage.',
        image: '/shop/acewears-joggers.png',
      },
    ],
  },
  {
    id: 'acelaptops',
    name: 'AceLaptops',
    tagline: 'Power for every table',
    description:
      'Order laptops of any class — creator beasts, featherweight ultrabooks and budget workhorses. Warranty included on every unit.',
    emoji: '💻',
    gradient: 'from-neutral-900 via-neutral-800 to-neutral-700',
    accent: 'text-amber-300',
    url: null, // ← AceLaptops store link lands here
    products: [
      {
        id: 'probook16',
        name: 'Ace ProBook 16',
        priceNaira: 1850000,
        blurb: 'The 16-inch creator beast — top-tier CPU, 32GB RAM, 1TB SSD and a 120Hz display that makes reels look cinematic.',
        image: '/shop/acelaptops-pro16.png',
        tag: 'Flagship',
      },
      {
        id: 'airbook14',
        name: 'Ace AirBook 14',
        priceNaira: 950000,
        blurb: '1.1kg of fanless silence — 14-inch ultrabook with an 18-hour battery for all-day hustling.',
        image: '/shop/acelaptops-air14.png',
      },
      {
        id: 'litebook14',
        name: 'Ace LiteBook 14',
        priceNaira: 450000,
        blurb: 'The student and starter pack — snappy daily performance, 256GB SSD and a full working day per charge.',
        image: '/shop/acelaptops-lite14.png',
        tag: 'Value pick',
      },
    ],
  },
  {
    id: 'acephones',
    name: 'AcePhones',
    tagline: 'Cards up. Phones out.',
    description:
      'Phones of any type — flagship cameras, big-battery mid-rangers and compact daily drivers. Sealed units, nationwide delivery.',
    emoji: '📱',
    gradient: 'from-purple-950 via-neutral-900 to-neutral-800',
    accent: 'text-purple-300',
    url: null, // ← AcePhones store link lands here
    products: [
      {
        id: 'ultra5g',
        name: 'Ace Ultra 5G',
        priceNaira: 1200000,
        blurb: 'Flagship triple camera, 120Hz AMOLED, 5,000mAh and full 5G — the crown of the lineup.',
        image: '/shop/acephones-ultra.png',
        tag: 'Flagship',
      },
      {
        id: 'note12',
        name: 'Ace Note 12',
        priceNaira: 550000,
        blurb: 'Big 6.7-inch display, 50MP main camera and a two-day battery for heavy scrollers.',
        image: '/shop/acephones-note12.png',
      },
      {
        id: 'mini',
        name: 'Ace Mini',
        priceNaira: 320000,
        blurb: 'Pocket-size, one-hand magic — the compact daily driver that never misses.',
        image: '/shop/acephones-mini.png',
        tag: 'Compact',
      },
    ],
  },
]

export function findShop(id: string): AceShop | undefined {
  return SHOPS.find((s) => s.id === id)
}
