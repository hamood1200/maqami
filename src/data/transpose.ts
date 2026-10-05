// نقل المقام إلى قرار آخر: نفس المسافات، والنغمات تُكتب بأسمائها الصحيحة
// (كل درجة تأخذ الحرف التالي، فراست على صول = صول لا سي½♭ دو ري مي فا½♯ صول).

import { parseNote, type Accidental, type ParsedNote } from './notes'
import type { Maqam } from './maqamat'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const NATURAL = [0, 200, 400, 500, 700, 900, 1100]
const ACC_BY_CENTS = new Map<number, Accidental>([
  [0, ''],
  [-100, 'b'],
  [100, '#'],
  [-50, 'hb'],
  [50, 'h#'],
])
// كلفة كل علامة عند اختيار أبسط كتابة (البيمول مفضّل قليلاً كما في التدوين العربي)
const ACC_COST: Record<Accidental, number> = { '': 0, b: 1, hb: 1, '#': 1.1, 'h#': 1.1 }
const FALLBACK_COST = 6

/** موضع الحرف على السلّم (دو4 = 28) */
function letterPos(p: ParsedNote) {
  return LETTERS.indexOf(p.letter) + p.octave * 7
}

/** كتابة نغمة بحرف محدد، أو null إن احتاجت علامة غير موجودة (مثل دبل بيمول) */
function spellAt(pos: number, cents: number): string | null {
  const idx = ((pos % 7) + 7) % 7
  const octave = Math.floor(pos / 7)
  const acc = ACC_BY_CENTS.get(cents - (NATURAL[idx] + (octave - 4) * 1200))
  return acc === undefined ? null : `${LETTERS[idx]}${acc}${octave}`
}

/** أقرب كتابة بسيطة لنغمة (عند تعذّر الحرف المتتالي) */
function plainSpelling(cents: number): string {
  const base = Math.floor(cents / 1200) * 7 + 28
  let best = ''
  let bestCost = Infinity
  for (let pos = base - 2; pos <= base + 9; pos++) {
    const s = spellAt(pos, cents)
    if (s && ACC_COST[parseNote(s).acc] < bestCost) {
      best = s
      bestCost = ACC_COST[parseNote(s).acc]
    }
  }
  return best
}

function transposeList(notes: string[], from: ParsedNote, to: string) {
  const t = parseNote(to)
  const dPos = letterPos(t) - letterPos(from)
  const dCents = t.cents - from.cents
  let cost = 0
  const out = notes.map((n) => {
    const p = parseNote(n)
    const s = spellAt(letterPos(p) + dPos, p.cents + dCents)
    if (s) {
      cost += ACC_COST[parseNote(s).acc]
      return s
    }
    cost += FALLBACK_COST
    return plainSpelling(p.cents + dCents)
  })
  return { notes: out, cost }
}

export interface TonicOption {
  /** الإزاحة بنصف التون عن القرار الأصلي */
  shift: number
  /** القرار بعد النقل بأبسط كتابة */
  tonic: string
}

/** أفضل كتابة للقرار الجديد: التي تعطي أقل عدد من العلامات في السلّم كله */
function bestTonic(m: Maqam, shift: number): string {
  const from = parseNote(m.notes[0])
  const target = from.cents + shift * 100
  const pos0 = letterPos(from) + Math.round((shift * 7) / 12)
  let best = ''
  let bestCost = Infinity
  for (let pos = pos0 - 2; pos <= pos0 + 2; pos++) {
    const tonic = spellAt(pos, target)
    if (!tonic) continue
    const cost =
      transposeList(m.notes, from, tonic).cost + (m.descending ? transposeList(m.descending, from, tonic).cost : 0) + ACC_COST[parseNote(tonic).acc] * 0.5
    if (cost < bestCost) {
      best = tonic
      bestCost = cost
    }
  }
  return best || plainSpelling(target)
}

/** اثنا عشر قراراً حول القرار الأصلي (من خامسة نازلة إلى تريتون صاعد) */
export function tonicOptions(m: Maqam): TonicOption[] {
  const opts: TonicOption[] = []
  for (let shift = -5; shift <= 6; shift++) opts.push({ shift, tonic: shift === 0 ? m.notes[0] : bestTonic(m, shift) })
  return opts
}

/** نسخة من المقام منقولة بعدد أنصاف التون المطلوب */
export function transposeMaqam(m: Maqam, shift: number): Maqam {
  if (!shift) return m
  const from = parseNote(m.notes[0])
  const tonic = bestTonic(m, shift)
  return {
    ...m,
    notes: transposeList(m.notes, from, tonic).notes,
    descending: m.descending && transposeList(m.descending, from, tonic).notes,
  }
}
