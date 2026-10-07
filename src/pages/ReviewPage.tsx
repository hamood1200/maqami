import { useEffect, useMemo, useRef, useState } from 'react'
import { FAMILIES, MAQAMAT, MAQAM_BY_ID, type Clip } from '../data/maqamat'
import { applyClipSettings, claimAudio, clipSource } from '../clipAudio'
import { engine } from '../audio/engine'
import { readJSON, writeJSON } from '../store'
import { fmtTime } from '../youtube'
import { arNum } from '../format'
import SAVED from '../data/review.json'

// صفحة مخفية (بالرابط فقط: #/review) يراجع فيها أستاذ موسيقى مقام كل مقطع في الموقع.
// الحكم على المقطع المسموع نفسه، لا على الأغنية كلها (قد تتحوّل الأغنية لمقام آخر).
// الاختيارات تُحفظ في متصفحه، ثم يرسلها نصاً. نحفظ آخر ما أرسله في data/review.json مرجعاً،
// فيظهر له من جديد على أي جهاز ويعدّل عليه.

type Verdict = 'ok' | 'fix' | 'unsure'
interface Answer {
  v: Verdict
  /** المقام الصحيح حين يكون المكتوب خطأ */
  to?: string
  note?: string
}

const KEY = 'maqami.review'
const NAME_KEY = 'maqami.review.name'

interface Item {
  key: string
  maqamId: string
  clip: Clip
}

const ITEMS: Item[] = MAQAMAT.flatMap((m) => m.examples.map((clip) => ({ key: `${m.id}:${clip.videoId}`, maqamId: m.id, clip })))

type Filter = 'all' | 'left' | 'fix'

export function ReviewPage() {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => readJSON(KEY, SAVED as Record<string, Answer>))
  const [name, setName] = useState(() => readJSON<string>(NAME_KEY, ''))
  const [filter, setFilter] = useState<Filter>('all')
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => writeJSON(KEY, answers), [answers])
  useEffect(() => writeJSON(NAME_KEY, name), [name])

  const set = (key: string, a: Answer | null) =>
    setAnswers((prev) => {
      const next = { ...prev }
      if (a) next[key] = a
      else delete next[key]
      return next
    })

  const done = ITEMS.filter((i) => answers[i.key]).length
  const fixes = ITEMS.filter((i) => answers[i.key]?.v === 'fix').length

  const shown = ITEMS.filter((i) => (filter === 'left' ? !answers[i.key] : filter === 'fix' ? answers[i.key] && answers[i.key].v !== 'ok' : true))
  const groups = MAQAMAT.map((m) => ({ m, items: shown.filter((i) => i.maqamId === m.id) })).filter((g) => g.items.length)

  const send = async () => {
    const text = reportText(answers, name)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'مراجعة مقامات مقامي', text })
        setSent('تم فتح المشاركة.')
        return
      }
    } catch (e) {
      // ألغى المشاركة
      if ((e as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(text)
      setSent('نُسخت النتائج. الصقها في رسالة.')
    } catch {
      setSent(text)
    }
  }

  return (
    <div className="review-page">
      <header className="page-head">
        <h1>مراجعة المقامات</h1>
        <p className="lead">
          اسمع كل مقطع وقرّر: هل المقام المكتوب صحيح <b>لهذا المقطع بالذات</b>؟ الأغنية قد تتحوّل لمقام آخر بعده، فالحكم على المسموع فقط. اختياراتك تُحفظ
          تلقائياً، وتستطيع تعديلها متى شئت. حين تنتهي اضغط «أرسل النتائج».
        </p>
        <label className="review-name">
          <span>اسمك</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="اختياري" autoComplete="name" />
        </label>
      </header>

      <div className="seg review-filter" role="group" aria-label="عرض">
        {(
          [
            ['all', 'الكل', ITEMS.length],
            ['left', 'لم أراجعها', ITEMS.length - done],
            ['fix', 'خطأ أو ؟', ITEMS.filter((i) => answers[i.key] && answers[i.key].v !== 'ok').length],
          ] as const
        ).map(([id, label, n]) => (
          <button key={id} type="button" className={`seg-btn ${filter === id ? 'on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            <b>{label}</b>
            <small>{arNum(n)}</small>
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="review-empty">لا شيء هنا.</p>}

      {groups.map(({ m, items }) => (
        <section key={m.id} className="review-group">
          <h2>
            {m.name}
            <small>{FAMILIES.find((f) => f.id === m.family)?.name}</small>
          </h2>
          <ol className="review-list">
            {items.map((it) => (
              <ReviewItem key={it.key} item={it} answer={answers[it.key]} onChange={(a) => set(it.key, a)} />
            ))}
          </ol>
        </section>
      ))}

      <div className="review-bar">
        <div className="review-progress" aria-label="التقدّم">
          <span>
            راجعت <b>{arNum(done)}</b> من {arNum(ITEMS.length)}
            {fixes > 0 && <> · عدّلت {arNum(fixes)}</>}
          </span>
          <span className="review-meter">
            <span style={{ width: `${(done / ITEMS.length) * 100}%` }} />
          </span>
        </div>
        <button type="button" className="btn btn-primary" onClick={send} disabled={!done}>
          أرسل النتائج
        </button>
      </div>

      {sent && (
        <div className="review-sent" role="status">
          {sent.length > 80 ? (
            <>
              <p>انسخ النص وأرسله:</p>
              <textarea readOnly value={sent} rows={8} onFocus={(e) => e.currentTarget.select()} />
            </>
          ) : (
            <p>{sent}</p>
          )}
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setSent(null)}>
            إغلاق
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewItem({ item, answer, onChange }: { item: Item; answer?: Answer; onChange: (a: Answer | null) => void }) {
  const { clip, maqamId } = item
  const v = answer?.v
  const pick = (nv: Verdict) => {
    if (v === nv) return onChange(null)
    onChange({ v: nv, to: nv === 'fix' ? answer?.to : undefined, note: answer?.note })
  }
  return (
    <li className={`review-item ${v ? `is-${v}` : ''}`}>
      <div className="review-song">
        <div className="review-meta">
          <b>{clip.song}</b>
          <span>
            {clip.artist} · من <bdi dir="ltr">{fmtTime(clip.start)}</bdi> إلى <bdi dir="ltr">{fmtTime(clip.end)}</bdi>
          </span>
        </div>
        <MiniPlayer clip={clip} />
      </div>

      <div className="review-current">
        <span>المقام المكتوب:</span>
        <b>{MAQAM_BY_ID[maqamId].name}</b>
        {clip.unconfirmed && <span className="review-flag">مصادره غير متفقة</span>}
      </div>

      <div className="review-verdict" role="group" aria-label="الحكم">
        <button type="button" className={v === 'ok' ? 'on' : ''} aria-pressed={v === 'ok'} onClick={() => pick('ok')}>
          ✓ صحيح
        </button>
        <button type="button" className={v === 'fix' ? 'on' : ''} aria-pressed={v === 'fix'} onClick={() => pick('fix')}>
          ✗ خطأ
        </button>
        <button type="button" className={v === 'unsure' ? 'on' : ''} aria-pressed={v === 'unsure'} onClick={() => pick('unsure')}>
          ؟ لست متأكداً
        </button>
      </div>

      {v === 'fix' && (
        <label className="review-field">
          <span>المقام الصحيح</span>
          <select value={answer?.to ?? ''} onChange={(e) => onChange({ ...answer!, to: e.target.value || undefined })}>
            <option value="">اختر…</option>
            {FAMILIES.map((f) => (
              <optgroup key={f.id} label={f.name}>
                {MAQAMAT.filter((m) => m.family === f.id && m.id !== maqamId).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="other">مقام غير موجود في القائمة (اكتبه في الملاحظة)</option>
          </select>
        </label>
      )}

      {v && (
        <label className="review-field">
          <span>ملاحظة</span>
          <input
            type="text"
            value={answer?.note ?? ''}
            onChange={(e) => onChange({ ...answer!, note: e.target.value || undefined })}
            placeholder={v === 'ok' ? 'اختياري' : 'مثلاً: يبدأ راست ثم يتحوّل إلى حجاز عند ١:٢٠'}
          />
        </label>
      )}
    </li>
  )
}

/** مشغّل صغير للمقطع: زر وشريط تقدّم يُضغط للتقديم */
function MiniPlayer({ clip }: { clip: Clip }) {
  const src = useMemo(() => clipSource(clip.videoId), [clip.videoId])
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [t, setT] = useState(clip.start)
  const [error, setError] = useState(false)
  const offset = src?.offset ?? 0
  const len = Math.max(1, clip.end - clip.start)
  const pos = (a: HTMLAudioElement) => a.currentTime + offset

  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => {
      const a = audio.current
      if (!a) return
      if (pos(a) >= clip.end) {
        a.pause()
        setT(clip.end)
        return
      }
      setT(pos(a))
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  if (!src)
    return (
      <a className="review-play" href={`https://www.youtube.com/watch?v=${clip.videoId}&t=${clip.start}s`} target="_blank" rel="noreferrer" aria-label="افتح على يوتيوب">
        ↗
      </a>
    )

  const start = (from: number) => {
    const a = audio.current
    if (!a) return
    a.currentTime = Math.max(0, from - offset)
    setT(from)
    claimAudio(a)
    applyClipSettings(a)
    engine.stopAll()
    a.play().catch(() => setPlaying(false))
  }

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (!a.paused) return a.pause()
    start(t >= clip.end - 0.25 || t < clip.start ? clip.start : t)
  }

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width))
    start(clip.start + f * len)
  }

  const frac = Math.min(1, Math.max(0, (t - clip.start) / len))

  return (
    <div className="review-player">
      <audio
        ref={audio}
        src={src.url}
        crossOrigin="anonymous"
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (pos(e.currentTarget) >= clip.end) e.currentTarget.pause()
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onError={() => setError(true)}
      />
      <button type="button" className="review-play" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل المقطع'}>
        {waiting && playing ? (
          <span className="clip-spinner" />
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}
          </svg>
        )}
      </button>
      <div
        className="review-track"
        role="slider"
        aria-label="موضع المقطع"
        aria-valuemin={0}
        aria-valuemax={Math.round(len)}
        aria-valuenow={Math.round(t - clip.start)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e)
        }}
        onPointerMove={(e) => e.buttons && seek(e)}
      >
        <span style={{ width: `${frac * 100}%` }} />
      </div>
      <span className="review-time">{error ? 'تعذّر التحميل' : `${fmtTime(t - clip.start)} / ${fmtTime(len)}`}</span>
    </div>
  )
}

/** نص النتائج: مقروء للإنسان، وفي آخره سطر رموز نطبّقه على البيانات */
function reportText(answers: Record<string, Answer>, name: string): string {
  const name_ = (id: string) => (id === 'other' ? 'غير موجود في القائمة' : (MAQAM_BY_ID[id]?.name ?? id))
  const done = ITEMS.filter((i) => answers[i.key])
  const fix = done.filter((i) => answers[i.key].v === 'fix')
  const unsure = done.filter((i) => answers[i.key].v === 'unsure')
  const ok = done.filter((i) => answers[i.key].v === 'ok')
  const line = (i: Item, n: number) => {
    const a = answers[i.key]
    const to = a.v === 'fix' ? ` ← ${a.to ? name_(a.to) : '؟'}` : ''
    const note = a.note ? ` (${a.note})` : ''
    return `${arNum(n)}. ${i.clip.song} — ${i.clip.artist}: ${MAQAM_BY_ID[i.maqamId].name}${to}${note}`
  }
  const out = [`مراجعة مقامات «مقامي»${name ? ` — ${name}` : ''}`, `راجعت ${arNum(done.length)} من ${arNum(ITEMS.length)} مقطعاً.`, '']
  if (fix.length) out.push(`المقام خطأ (${arNum(fix.length)}):`, ...fix.map((i, n) => line(i, n + 1)), '')
  if (unsure.length) out.push(`لست متأكداً (${arNum(unsure.length)}):`, ...unsure.map((i, n) => line(i, n + 1)), '')
  const okNotes = ok.filter((i) => answers[i.key].note)
  out.push(`صحيح: ${arNum(ok.length)} مقطعاً.`)
  if (okNotes.length) out.push('ملاحظات على الصحيح:', ...okNotes.map((i, n) => line(i, n + 1)))
  // كل الاختيارات كما هي، لنحفظها في data/review.json
  out.push('', 'رمز للموقع (لا تحذفه):', `#${JSON.stringify(Object.fromEntries(done.map((i) => [i.key, answers[i.key]])))}`)
  return out.join('\n')
}
