import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAQAMAT, MAQAM_BY_ID, type Clip, type Maqam } from '../data/maqamat'
import { AJNAS, type Jins } from '../data/ajnas'
import { noteCents } from '../data/notes'
import { engine, type SeqEvent } from '../audio/engine'
import { maqamEvents, notesEvents, phraseCount } from '../audio/phrases'
import { allClips } from '../clips'
import { ClipCard } from '../components/ClipCard'
import { SoundSettings } from '../components/SoundSettings'
import { usePlayback } from '../usePlayback'
import { readJSON, useSettings, writeJSON } from '../store'
import { href } from '../router'
import { Disc } from '../components/Disc'
import { arNum } from '../format'

type Mode = 'maqam' | 'jins' | 'clip'
type Level = 'basic' | 'all'
type Style = 'scale' | 'phrase'

interface Option {
  id: string
  name: string
}

interface Question {
  n: number
  answer: Option
  options: Option[]
  /** للمقام والجنس */
  events?: SeqEvent[]
  /** للمقطع الغنائي */
  clip?: { maqamId: string; clip: Clip }
  transpose: number
}

interface Stats {
  total: number
  correct: number
  best: number
}

const STATS_KEY = 'maqami.quiz'
const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: 'maqam', name: 'المقامات', hint: 'نعزف مقاماً على الأورغ' },
  { id: 'jins', name: 'الأجناس', hint: 'نعزف جنساً واحداً' },
  { id: 'clip', name: 'من الأغاني', hint: 'مقطع غنائي بدون اسمه' },
]
const TRANSPOSES = [-300, -200, -100, 100, 200]

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function makeOptions(answer: Option, pool: Option[]): Option[] {
  const others = shuffle(pool.filter((o) => o.id !== answer.id)).slice(0, 3)
  return shuffle([answer, ...others])
}

const maqamOpt = (m: Maqam): Option => ({ id: m.id, name: m.name })
const jinsOpt = (j: Jins): Option => ({ id: j.id, name: j.name })

export function QuizPage({ focus }: { focus?: string }) {
  const initialMode: Mode = focus === 'jins' || focus === 'clip' ? focus : 'maqam'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [level, setLevel] = useState<Level>('basic')
  const [style, setStyle] = useState<Style>('phrase')
  const [transpose, setTranspose] = useState(false)
  const [q, setQ] = useState<Question | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [stats, setStats] = useState<Stats>(() => readJSON(STATS_KEY, { total: 0, correct: 0, best: 0 }))
  const settings = useSettings()
  const { playing, play, stop } = usePlayback()

  const maqamPool = useMemo(() => MAQAMAT.filter((m) => level === 'all' || m.basic), [level])
  const jinsPool = useMemo(() => AJNAS.filter((j) => level === 'all' || j.basic), [level])
  const clipPool = useMemo(() => allClips((m) => level === 'all' || m.basic), [level])

  // في وضع الأغاني نعرض فقط المقامات التي لها مقاطع
  const clipMaqamPool = useMemo(() => {
    const ids = new Set(clipPool.map((c) => c.maqam.id))
    return MAQAMAT.filter((m) => ids.has(m.id))
  }, [clipPool])

  const nextQuestion = useCallback(() => {
    stop()
    engine.stopDrone()
    setChosen(null)
    const n = (q?.n ?? 0) + 1
    const tr = transpose ? pick(TRANSPOSES) : 0
    let next: Question
    if (mode === 'maqam') {
      const m = pick(maqamPool.filter((x) => x.id !== q?.answer.id))
      const events = maqamEvents(m, style === 'scale' ? 'updown' : 'phrase', settings.bpm, {
        transpose: tr,
        phrase: Math.floor(Math.random() * phraseCount()),
      })
      next = { n, answer: maqamOpt(m), options: makeOptions(maqamOpt(m), maqamPool.map(maqamOpt)), events, transpose: tr }
    } else if (mode === 'jins') {
      const j = pick(jinsPool.filter((x) => x.id !== q?.answer.id))
      const events = notesEvents(j.notes, settings.bpm, { updown: true, transpose: tr })
      next = { n, answer: jinsOpt(j), options: makeOptions(jinsOpt(j), jinsPool.map(jinsOpt)), events, transpose: tr }
    } else {
      const ref = pick(clipPool.filter((c) => c.maqam.id !== q?.answer.id)) ?? pick(clipPool)
      next = {
        n,
        answer: maqamOpt(ref.maqam),
        options: makeOptions(maqamOpt(ref.maqam), clipMaqamPool.map(maqamOpt)),
        clip: { maqamId: ref.maqam.id, clip: ref.clip },
        transpose: 0,
      }
    }
    setQ(next)
    if (next.events) play('q', next.events)
  }, [mode, maqamPool, jinsPool, clipPool, clipMaqamPool, style, transpose, settings.bpm, q, play, stop])

  // تغيير الإعدادات يبدأ جولة جديدة
  useEffect(() => {
    stop()
    setQ(null)
    setChosen(null)
  }, [mode, level, style, transpose, stop])

  useEffect(() => () => engine.stopDrone(), [])

  const answer = (id: string) => {
    if (!q || chosen) return
    setChosen(id)
    const ok = id === q.answer.id
    const s = streak + (ok ? 1 : 0)
    setStreak(ok ? s : 0)
    const nextStats = { total: stats.total + 1, correct: stats.correct + (ok ? 1 : 0), best: Math.max(stats.best, ok ? s : 0) }
    setStats(nextStats)
    writeJSON(STATS_KEY, nextStats)
  }

  const replay = () => {
    if (!q?.events) return
    if (playing) return stop()
    play('q', q.events)
  }

  const playRef = () => {
    if (!q) return
    // القرار بنفس التحويل المستخدم في السؤال
    const tonic =
      mode === 'jins' ? AJNAS.find((j) => j.id === q.answer.id)!.notes[0] : MAQAM_BY_ID[q.answer.id].notes[0]
    engine.playNote(noteCents(tonic) + q.transpose, 1.4)
  }

  const compare = (id: string) => {
    if (!q) return
    const tr = q.transpose
    if (mode === 'jins') {
      const j = AJNAS.find((x) => x.id === id)!
      play(`cmp-${id}`, notesEvents(j.notes, settings.bpm, { updown: true, transpose: tr }))
    } else {
      play(`cmp-${id}`, maqamEvents(MAQAM_BY_ID[id], 'updown', settings.bpm, { transpose: tr }))
    }
  }

  // اختصارات: 1-4 للإجابة، المسافة للإعادة، Enter للتالي
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, select, textarea, a')) return
      if (!q) {
        if (e.key === 'Enter') nextQuestion()
        return
      }
      const k = Number(e.key)
      if (k >= 1 && k <= q.options.length && !chosen) answer(q.options[k - 1].id)
      else if (e.key === 'Enter' && chosen) nextQuestion()
      else if (e.code === 'Space' && q.events) {
        e.preventDefault()
        replay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const resetStats = () => {
    const s = { total: 0, correct: 0, best: 0 }
    setStats(s)
    setStreak(0)
    writeJSON(STATS_KEY, s)
  }

  const isCorrect = chosen && q && chosen === q.answer.id
  const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
  const learnHref = q && mode !== 'jins' ? href.maqam(q.answer.id) : href.ajnas

  return (
    <div className="quiz-page">
      <header className="page-head">
        <h1>اختبر أذنك</h1>
        <p className="lead">استمع، ثم اختر الإجابة. لا تبحث عن اسم النغمة — ركّز على «طعم» المقام: أين تقع النغمة الثالثة؟ هل فيه ربع تون؟ هل فيه مسافة تون ونصف؟</p>
      </header>

      <section className="panel quiz-settings">
        <div className="seg" role="radiogroup" aria-label="نوع الاختبار">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`seg-btn ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
              <b>{m.name}</b>
              <small>{m.hint}</small>
            </button>
          ))}
        </div>
        <div className="quiz-opts">
          <label className="field">
            <span>المستوى</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              <option value="basic">{mode === 'jins' ? 'الأجناس الأساسية' : 'المقامات الثمانية الأساسية'}</option>
              <option value="all">{mode === 'jins' ? 'كل الأجناس' : 'كل المقامات'}</option>
            </select>
          </label>
          {mode === 'maqam' && (
            <label className="field">
              <span>طريقة العزف</span>
              <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
                <option value="phrase">جملة لحنية</option>
                <option value="scale">السلّم صعوداً وهبوطاً</option>
              </select>
            </label>
          )}
          {mode !== 'clip' && (
            <label className="check">
              <input type="checkbox" checked={transpose} onChange={(e) => setTranspose(e.target.checked)} />
              <span>طبقة عشوائية (أصعب)</span>
            </label>
          )}
        </div>
      </section>

      <section className="panel quiz-card">
        {!q ? (
          <div className="quiz-start">
            <p>
              {mode === 'clip'
                ? `سنشغّل مقطعاً من أغنية دون أن نخبرك باسمها (${clipPool.length} مقطعاً متاحاً).`
                : mode === 'jins'
                  ? `سنعزف واحداً من ${jinsPool.length} أجناس.`
                  : `سنعزف واحداً من ${maqamPool.length} مقاماً.`}
            </p>
            <button type="button" className="btn btn-primary btn-lg" onClick={nextQuestion}>
              ابدأ
            </button>
          </div>
        ) : (
          <>
            <div className="quiz-q-head">
              <span className="q-num">السؤال {arNum(q.n)}</span>
              <h2>{mode === 'jins' ? 'ما هذا الجنس؟' : 'ما هذا المقام؟'}</h2>
            </div>

            {q.clip ? (
              <div className="quiz-clip">
                <ClipCard key={`${q.n}-${q.clip.clip.videoId}`} maqamId={q.clip.maqamId} clip={q.clip.clip} hideMeta={!chosen} />
              </div>
            ) : (
              <div className="quiz-listen">
                <button type="button" className={`listen-btn ${playing === 'q' ? 'playing' : ''}`} onClick={replay} aria-label="إعادة الاستماع">
                  <Disc label={playing === 'q' ? '■' : '▶︎'} spinning={playing === 'q'} />
                  <span>{playing === 'q' ? 'إيقاف' : 'استمع مرة أخرى'}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={playRef}>
                  اسمع القرار
                </button>
              </div>
            )}

            <div className="answers">
              {q.options.map((o, i) => {
                const state = !chosen ? '' : o.id === q.answer.id ? 'correct' : o.id === chosen ? 'wrong' : 'dim'
                return (
                  <button key={o.id} type="button" className={`answer ${state}`} onClick={() => answer(o.id)} disabled={!!chosen}>
                    <kbd>{i + 1}</kbd>
                    {o.name}
                  </button>
                )
              })}
            </div>

            {chosen && (
              <div className={`feedback ${isCorrect ? 'ok' : 'bad'}`} role="status">
                <div className="feedback-text">
                  <b>{isCorrect ? 'إجابة صحيحة!' : `الإجابة الصحيحة: ${q.answer.name}`}</b>
                  {!isCorrect && mode !== 'clip' && <span>قارن بين الاثنين بأذنك:</span>}
                </div>
                <div className="feedback-actions">
                  {!isCorrect && mode !== 'clip' && (
                    <>
                      <button type="button" className={`btn btn-small btn-play ${playing === `cmp-${q.answer.id}` ? 'playing' : ''}`} onClick={() => compare(q.answer.id)}>
                        ▶︎ {q.answer.name}
                      </button>
                      <button type="button" className={`btn btn-small btn-play ${playing === `cmp-${chosen}` ? 'playing' : ''}`} onClick={() => compare(chosen)}>
                        ▶︎ {q.options.find((o) => o.id === chosen)?.name}
                      </button>
                    </>
                  )}
                  <a className="btn btn-small btn-ghost" href={learnHref}>
                    {mode === 'jins' ? 'راجع الأجناس' : `تعلّم ${q.answer.name}`}
                  </a>
                  <button type="button" className="btn btn-primary" onClick={nextQuestion}>
                    السؤال التالي ←
                  </button>
                </div>
              </div>
            )}
            <p className="kbd-hint muted">
              اختصارات: <kbd>1</kbd>–<kbd>4</kbd> للإجابة{q.events && <>، <kbd>مسافة</kbd> للإعادة</>}، <kbd>Enter</kbd> للتالي
            </p>
          </>
        )}
      </section>

      <section className="stats">
        <div>
          <span className="stat-num">{arNum(streak)}</span>
          <span className="muted">متتالية</span>
        </div>
        <div>
          <span className="stat-num">{arNum(pct)}٪</span>
          <span className="muted">
            دقة ({stats.correct}/{stats.total})
          </span>
        </div>
        <div>
          <span className="stat-num">{arNum(stats.best)}</span>
          <span className="muted">أفضل سلسلة</span>
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={resetStats}>
          تصفير
        </button>
      </section>

      {mode !== 'clip' && (
        <details className="panel quiz-sound">
          <summary>إعدادات الصوت</summary>
          <SoundSettings />
        </details>
      )}
    </div>
  )
}
