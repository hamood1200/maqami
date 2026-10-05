// نظام النغمات: كل نغمة تُكتب كحرف + علامة + أوكتاف، مثل "C4" أو "Eb4" أو "Ehb4" (مي نصف بيمول).
// نعتمد سلّم الأرباع (24 ربع تون في الديوان) كما هو مضبوط في الأورغ الشرقي.

export type Accidental = '' | 'b' | '#' | 'hb' | 'h#'

export interface ParsedNote {
  letter: Letter
  acc: Accidental
  octave: number
  /** المسافة بالسنت من دو الوسطى (C4) */
  cents: number
}

type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

const LETTER_SEMIS: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACC_CENTS: Record<Accidental, number> = { '': 0, b: -100, '#': 100, hb: -50, 'h#': 50 }

export const LETTER_AR: Record<Letter, string> = {
  C: 'دو',
  D: 'ري',
  E: 'مي',
  F: 'فا',
  G: 'صول',
  A: 'لا',
  B: 'سي',
}

export const ACC_AR: Record<Accidental, string> = {
  '': '',
  b: 'بيمول',
  '#': 'دييز',
  hb: 'نصف بيمول',
  'h#': 'نصف دييز',
}

// الأسماء التقليدية للنغمات في الموسيقى العربية
const TRADITIONAL: Record<string, string> = {
  G3: 'يكاه',
  A3: 'عشيران',
  Bb3: 'عجم عشيران',
  Bhb3: 'عراق',
  B3: 'كوشت',
  C4: 'راست',
  D4: 'دوكاه',
  Eb4: 'كرد',
  Ehb4: 'سيكاه',
  E4: 'بوسليك',
  F4: 'جهاركاه',
  'F#4': 'حجاز',
  Gb4: 'حجاز',
  G4: 'نوى',
  Ab4: 'حصار',
  A4: 'حسيني',
  Bb4: 'عجم',
  Bhb4: 'أوج',
  B4: 'ماهور',
  C5: 'كردان',
  'C#5': 'شهناز',
  Db5: 'شهناز',
  D5: 'محيّر',
  Ehb5: 'بزرك',
}

const NOTE_RE = /^([A-G])(hb|h#|b|#)?(-?\d)$/

const cache = new Map<string, ParsedNote>()

export function parseNote(n: string): ParsedNote {
  const hit = cache.get(n)
  if (hit) return hit
  const m = NOTE_RE.exec(n)
  if (!m) throw new Error(`نغمة غير صالحة: ${n}`)
  const letter = m[1] as Letter
  const acc = (m[2] ?? '') as Accidental
  const octave = Number(m[3])
  const cents = LETTER_SEMIS[letter] * 100 + ACC_CENTS[acc] + (octave - 4) * 1200
  const p = { letter, acc, octave, cents }
  cache.set(n, p)
  return p
}

export function noteCents(n: string): number {
  return parseNote(n).cents
}

/** الاسم العربي: "مي" + العلامة (تُعرض العلامة كرمز منفصل في الواجهة) */
export function noteNameAr(n: string): string {
  return LETTER_AR[parseNote(n).letter]
}

export function noteFullNameAr(n: string): string {
  const p = parseNote(n)
  return [LETTER_AR[p.letter], ACC_AR[p.acc]].filter(Boolean).join(' ')
}

export function traditionalName(n: string): string | undefined {
  return TRADITIONAL[n]
}

/**
 * على الأورغ الشرقي تُعزف نغمة الربع بالضغط على المفتاح الأعلى منها بعد خفضه ربع تون.
 * مي نصف بيمول = مفتاح مي مخفوضاً 50 سنت. لذلك نأخذ السقف دائماً.
 */
export function physicalKey(cents: number): { key: number; detune: number } {
  const key = Math.ceil(cents / 100 - 1e-9)
  return { key, detune: Math.round(cents - key * 100) }
}

export function isBlackKey(semi: number): boolean {
  const pc = ((semi % 12) + 12) % 12
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10
}

export function intervalLabel(cents: number): string {
  const c = Math.round(cents)
  switch (c) {
    case 50:
      return 'ربع تون'
    case 100:
      return 'نصف تون'
    case 150:
      return '¾ تون'
    case 200:
      return 'تون'
    case 250:
      return '1¼ تون'
    case 300:
      return 'تون ونصف'
    default:
      return `${(c / 200).toFixed(2)} تون`
  }
}

/** رمز قصير للمسافة يُعرض بين النغمات */
export function intervalShort(cents: number): string {
  const c = Math.round(cents)
  const map: Record<number, string> = { 50: '¼', 100: '½', 150: '¾', 200: '1', 250: '1¼', 300: '1½' }
  return map[c] ?? (c / 200).toFixed(2)
}

export const C4_HZ = 261.6256

export function centsToHz(cents: number): number {
  return C4_HZ * Math.pow(2, cents / 1200)
}
