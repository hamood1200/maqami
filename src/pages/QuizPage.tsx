import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAQAMAT, MAQAM_BY_ID, type Clip, type Maqam } from '../data/maqamat'
import { AJNAS, type Jins } from '../data/ajnas'
import { noteCents } from '../data/notes'
import { engine, type SeqEvent } from '../audio/engine'
import { maqamEvents, notesEvents, phraseCount, songPhraseEvents, type SongNote } from '../audio/phrases'
import { allClips } from '../clips'
import { useReviewVersion } from '../review'
import { claimAudio, clipSource, pauseClip } from '../clipAudio'
import CLIP_PHRASES from '../data/clipPhrases.json'
import { ClipCard } from '../components/ClipCard'
import { SoundSettings } from '../components/SoundSettings'
import { usePlayback } from '../usePlayback'
import { readJSON, useSettings, writeJSON } from '../store'
import { href } from '../router'
import { Disc } from '../components/Disc'
import { arNum } from '../format'
import { fmtTime } from '../youtube'

/** جمل مستخرجة آلياً من لحن الأغاني (tools/clip-phrases.mjs): ١٦ نغمة من المقطع نفسه */
const PHRASES = CLIP_PHRASES as unknown as Record<string, { at: number; end: number; notes: SongNote[] }>
/** شرح الخطأ بجملة من الأغنية: على جهاز التطوير فقط حتى نكمله */
const SONG_PHRASES = import.meta.env.DEV

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
/** الأغاني التي سمعها الطالب في اختبارات سابقة، حتى نعطيه أغاني جديدة كل مرة */
const SEEN_KEY = 'maqami.quiz.seenClips'
/** عدد أسئلة الاختبار، ونسبة النجاح */
const ROUND = 20
const PASS = 70
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
  const settings = useSettings()
  // المبتدئ: المقامات الثمانية فقط، بلا أجناس ولا طبقة عشوائية
  const beginner = settings.level === 'beginner'
  const initialMode: Mode = focus === 'clip' || (focus === 'jins' && !beginner) ? focus : 'maqam'
  const [modeChoice, setMode] = useState<Mode>(initialMode)
  const mode: Mode = beginner && modeChoice === 'jins' ? 'maqam' : modeChoice
  const [levelChoice, setLevel] = useState<Level>('basic')
  const level: Level = beginner ? 'basic' : levelChoice
  const [style, setStyle] = useState<Style>('phrase')
  const [transposeChoice, setTranspose] = useState(false)
  const transpose = transposeChoice && !beginner
  const [q, setQ] = useState<Question | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  // الاختبار الحالي: الإجابات الصحيحة، وهل انتهى، والأغاني التي ظهرت فيه
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const roundClips = useRef(new Set<string>())
  const [stats, setStats] = useState<Stats>(() => readJSON(STATS_KEY, { total: 0, correct: 0, best: 0 }))
  const { playing, play, stop } = usePlayback()

  const maqamPool = useMemo(() => MAQAMAT.filter((m) => level === 'all' || m.basic), [level])
  const jinsPool = useMemo(() => AJNAS.filter((j) => level === 'all' || j.basic), [level])
  // الأغاني غير المؤكدة المقام لا تدخل الاختبار حتى لا نصحّح إجابة صحيحة كأنها خطأ
  const reviewed = useReviewVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clipPool = useMemo(() => allClips((m) => level === 'all' || m.basic).filter((c) => !c.clip.unconfirmed), [level, reviewed])

  // في وضع الأغاني نعرض فقط المقامات التي لها مقاطع
  const clipMaqamPool = useMemo(() => {
    const ids = new Set(clipPool.map((c) => c.maqam.id))
    return MAQAMAT.filter((m) => ids.has(m.id))
  }, [clipPool])

  const nextQuestion = useCallback((fresh = false) => {
    stop()
    engine.stopDrone()
    setChosen(null)
    if (!fresh && q && q.n >= ROUND) {
      pauseClip()
      setDone(true)
      return
    }
    if (fresh) roundClips.current = new Set()
    const n = fresh ? 1 : (q?.n ?? 0) + 1
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
      // على جهاز التطوير: ‎?song=<videoId>‎ قبل # يجعل أول سؤال من هذه الأغنية (لتجربة الشرح)
      const forced = import.meta.env.DEV && n === 1 ? new URLSearchParams(location.search).get('song') : null
      // لا تتكرر أغنية في نفس الاختبار، ونفضّل أغاني لم يسمعها في اختبارات سابقة؛
      // إذا سمعها كلها نبدأ الدورة من جديد
      const pool = clipPool.filter((c) => !roundClips.current.has(c.clip.videoId))
      let seen = new Set(readJSON<string[]>(SEEN_KEY, []))
      let unseen = pool.filter((c) => !seen.has(c.clip.videoId))
      if (!unseen.length) {
        seen = new Set(roundClips.current)
        unseen = pool
      }
      const ref =
        (forced && allClips(() => true).find((c) => c.clip.videoId === forced)) ||
        pick(unseen.filter((c) => c.maqam.id !== q?.answer.id)) ||
        pick(unseen)
      roundClips.current.add(ref.clip.videoId)
      seen.add(ref.clip.videoId)
      writeJSON(SEEN_KEY, [...seen])
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
    setScore(0)
    setDone(false)
  }, [mode, level, style, transpose, stop])

  const newRound = () => {
    setScore(0)
    setDone(false)
    nextQuestion(true)
  }

  useEffect(() => () => engine.stopDrone(), [])

  const answer = (id: string) => {
    if (!q || chosen) return
    setChosen(id)
    const ok = id === q.answer.id
    if (ok) setScore((x) => x + 1)
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

  // شرح الإجابة الخاطئة في وضع الأغاني: نفس الجملة من التسجيل ثم على الأورغ،
  // أو جملة عامة من المقام إن لم نستخرج جملة من هذه الأغنية
  const songPhrase = q?.clip ? PHRASES[q.clip.clip.videoId] : undefined
  const original = useRef<HTMLAudioElement | null>(null)
  const [hearing, setHearing] = useState(false)
  const stopOriginal = () => {
    original.current?.pause()
    setHearing(false)
  }
  useEffect(() => stopOriginal, [q])
  const hearOriginal = () => {
    if (!q?.clip || !songPhrase) return
    if (hearing) return stopOriginal()
    const src = clipSource(q.clip.clip.videoId)
    if (!src) return
    stop()
    const a = original.current ?? new Audio()
    original.current = a
    if (!a.src.endsWith(src.url)) a.src = src.url
    const from = songPhrase.at - src.offset
    const to = songPhrase.end - src.offset + 0.3
    a.ontimeupdate = () => a.currentTime >= to && stopOriginal()
    a.onpause = () => setHearing(false)
    claimAudio(a)
    a.currentTime = from
    void a.play()
    setHearing(true)
  }
  const explain = () => {
    if (!q?.clip) return
    if (playing === 'explain') return stop()
    pauseClip()
    stopOriginal()
    play('explain', songPhrase ? songPhraseEvents(songPhrase.notes) : maqamEvents(MAQAM_BY_ID[q.answer.id], 'phrase', settings.bpm, { phrase: 0 }))
  }

  const compare = (id: string) => {
    if (!q) return
    pauseClip()
    stopOriginal()
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
      if (!q || done) {
        if (e.key === 'Enter') newRound()
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
        <p className="lead">{beginner ? 'استمع، ثم اختر اسم المقام. ركّز على «طعمه»: هل هو فرِح، حزين، أم شرقي فيه ربع تون؟' : <>استمع، ثم اختر الإجابة. لا تبحث عن اسم النغمة — ركّز على «طعم» المقام: أين تقع النغمة الثالثة؟ هل فيه ربع تون؟ هل فيه مسافة تون ونصف؟</>}</p>
      </header>

      <section className="panel quiz-settings">
        <div className="seg" role="radiogroup" aria-label="نوع الاختبار">
          {MODES.filter((m) => !beginner || m.id !== 'jins').map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`seg-btn ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
              <b>{m.name}</b>
              <small>{m.hint}</small>
            </button>
          ))}
        </div>
        <div className="quiz-opts">
          {!beginner && (
            <label className="field">
              <span>المستوى</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                <option value="basic">{mode === 'jins' ? 'الأجناس الأساسية' : 'المقامات الثمانية الأساسية'}</option>
                <option value="all">{mode === 'jins' ? 'كل الأجناس' : 'كل المقامات'}</option>
              </select>
            </label>
          )}
          {mode === 'maqam' && (
            <label className="field">
              <span>طريقة العزف</span>
              <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
                <option value="phrase">جملة لحنية</option>
                <option value="scale">السلّم صعوداً وهبوطاً</option>
              </select>
            </label>
          )}
          {mode !== 'clip' && !beginner && (
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
            <p className="muted">
              الاختبار {arNum(ROUND)} سؤالاً، والنجاح من {arNum(PASS)}٪.
            </p>
            <button type="button" className="btn btn-primary btn-lg" onClick={newRound}>
              ابدأ
            </button>
          </div>
        ) : done ? (
          <QuizResult score={score} again={mode === 'clip' ? 'اختبر بأغاني ثانية' : 'اختبار جديد'} onAgain={newRound} />
        ) : (
          <>
            <div className="quiz-q-head">
              <span className="q-num">
                السؤال {arNum(q.n)} من {arNum(ROUND)}
              </span>
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
                  {!isCorrect && (mode !== 'clip' || !SONG_PHRASES) && <span>قارن بين الاثنين بأذنك:</span>}
                  {!isCorrect && mode === 'clip' && SONG_PHRASES && (
                    <span>
                      {songPhrase
                        ? `هاي ${arNum(songPhrase.notes.length)} نغمة من الغناء بالدقيقة ${fmtTime(Math.floor(songPhrase.at))}: اسمعها من الأغنية، وبعدين نفسها على الأورغ بنفس الطبقة. كل نغماتها من ${q.answer.name}.`
                        : `اسمع جملة من ${q.answer.name} على الأورغ، ثم قارن السلّمين وارجع للمقطع.`}
                    </span>
                  )}
                </div>
                <div className="feedback-actions">
                  {!isCorrect && mode === 'clip' && SONG_PHRASES && songPhrase && (
                    <button type="button" className={`btn btn-small btn-play ${hearing ? 'playing' : ''}`} onClick={hearOriginal}>
                      {hearing ? '■' : '▶︎'} من الأغنية
                    </button>
                  )}
                  {!isCorrect && mode === 'clip' && SONG_PHRASES && (
                    <button type="button" className={`btn btn-small btn-play ${playing === 'explain' ? 'playing' : ''}`} onClick={explain}>
                      {playing === 'explain' ? '■' : '▶︎'} {songPhrase ? 'نفسها على الأورغ' : `جملة من ${q.answer.name}`}
                    </button>
                  )}
                  {!isCorrect && (
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
                  <button type="button" className="btn btn-primary" onClick={() => nextQuestion()}>
                    {q.n >= ROUND ? 'شوف النتيجة ←' : 'السؤال التالي ←'}
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

function QuizResult({ score, again, onAgain }: { score: number; again: string; onAgain: () => void }) {
  const pct = Math.round((score / ROUND) * 100)
  const pass = pct >= PASS
  return (
    <div className={`quiz-result ${pass ? 'pass' : 'fail'}`} role="status">
      <span className="q-num">النتيجة</span>
      <h2>{pass ? 'ناجح' : 'راسب'}</h2>
      <p className="quiz-result-score">
        {arNum(score)} من {arNum(ROUND)} <span>({arNum(pct)}٪)</span>
      </p>
      <p className="muted">
        {pass
          ? 'أذنك صارت تميّز المقامات. جرّب اختباراً جديداً بأغانٍ ما سمعتها.'
          : `النجاح من ${arNum(PASS)}٪. راجع المقامات اللي غلطت فيها وجرّب مرة ثانية بأغانٍ جديدة.`}
      </p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onAgain}>
        {again}
      </button>
    </div>
  )
}
