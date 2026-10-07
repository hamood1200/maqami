// أحكام أستاذ الموسيقى من صفحة المراجعة (#/review) تُطبَّق على الموقع كله مباشرة:
// مقطع حكم عليه بمقام آخر ينتقل إلى ذلك المقام (في صفحته وفي الاختبار)، و«لست متأكداً» يخرجه من الاختبار.
// المصدر: جدول Google Sheets (data/reviewSheet.ts)، وقبل وصوله آخر نسخة في المتصفح ثم data/review.json.

import { useSyncExternalStore } from 'react'
import { MAQAMAT, MAQAM_BY_ID, type Clip } from './data/maqamat'
import SAVED from './data/review.json'
import { REVIEW_SHEET_URL } from './data/reviewSheet'
import { readJSON, writeJSON } from './store'

export type Verdict = 'ok' | 'fix' | 'unsure'
export interface Answer {
  v: Verdict
  /** المقام الصحيح حين يكون المكتوب خطأ */
  to?: string
  note?: string
}
export type Answers = Record<string, Answer>

export interface ReviewItem {
  /** `${المقام المكتوب في الملف}:${videoId}` */
  key: string
  maqamId: string
  clip: Clip
}

/** المقاطع كما في data/maqamat.ts قبل أي تعديل */
export const ORIGINAL: ReviewItem[] = MAQAMAT.flatMap((m) => m.examples.map((clip) => ({ key: `${m.id}:${clip.videoId}`, maqamId: m.id, clip: { ...clip } })))

const LIVE_KEY = 'maqami.review.live'
/** نسخة الأستاذ في صفحة المراجعة */
export const TEACHER_KEY = 'maqami.review'
/** أحكام لم تصل الجدول بعد من هذا الجهاز (null = حذف) */
export const PENDING_KEY = 'maqami.review.pending'

let answers: Answers = readJSON<Answers>(LIVE_KEY, readJSON<Answers>(TEACHER_KEY, SAVED as Answers))
let version = 0
const subs = new Set<() => void>()

function apply() {
  const lists = new Map<string, Clip[]>(MAQAMAT.map((m) => [m.id, []]))
  const moved: [string, Clip][] = []
  for (const { key, maqamId, clip } of ORIGINAL) {
    const a = answers[key]
    const c: Clip = { ...clip }
    if (a?.v === 'ok') c.unconfirmed = undefined
    else if (a?.v === 'unsure' || (a?.v === 'fix' && !(a.to && MAQAM_BY_ID[a.to]))) c.unconfirmed = true
    if (a?.v === 'fix' && a.to && MAQAM_BY_ID[a.to] && a.to !== maqamId) {
      c.unconfirmed = undefined
      // الشرح القديم يصف المقام القديم
      c.hint = a.note ? `حسب مراجعة أستاذ موسيقى: ${a.note}` : `حسب مراجعة أستاذ موسيقى، هذا المقطع على مقام ${MAQAM_BY_ID[a.to].name}.`
      moved.push([a.to, c])
      continue
    }
    lists.get(maqamId)!.push(c)
  }
  for (const [to, c] of moved) lists.get(to)!.push(c)
  for (const m of MAQAMAT) m.examples = lists.get(m.id)!
  version++
  subs.forEach((f) => f())
}

apply()

/** يتغيّر كلما تغيّرت الأحكام، لإعادة حساب ما يُبنى من المقاطع */
export function useReviewVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => version,
  )
}

export function reviewAnswers(): Answers {
  return answers
}

/** أحكام جديدة (من الجدول أو من الأستاذ نفسه وهو يراجع) */
export function setReviewAnswers(next: Answers) {
  if (JSON.stringify(next) === JSON.stringify(answers)) return
  answers = next
  writeJSON(LIVE_KEY, answers)
  apply()
}

/** آخر الأحكام في الجدول، وفوقها ما لم يصله بعد من هذا الجهاز */
export async function fetchReview(): Promise<Answers | null> {
  if (!REVIEW_SHEET_URL) return null
  const r = await fetch(REVIEW_SHEET_URL)
  if (!r.ok) throw new Error(String(r.status))
  const next = (await r.json()) as Answers
  for (const [k, a] of Object.entries(readJSON<Record<string, Answer | null>>(PENDING_KEY, {}))) {
    if (a) next[k] = a
    else delete next[k]
  }
  return next
}

let loading: Promise<Answers | null> | null = null
/** مرة عند فتح الموقع */
export function loadReview(): Promise<Answers | null> {
  loading ??= fetchReview()
    .then((a) => {
      if (a) setReviewAnswers(a)
      return a
    })
    .catch(() => null)
  return loading
}
