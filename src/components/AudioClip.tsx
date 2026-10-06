import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react'
import { applyClipSettings, claimAudio, setClipSettings, useClipSettings } from '../clipAudio'
import { fmtTime } from '../youtube'
import { engine } from '../audio/engine'
import { arNum } from '../format'

export interface ClipControl {
  replay: (start: number, end: number) => void
  /** الثانية الحالية في الأغنية */
  now: () => number
}

interface Props {
  src: string
  /** موضع بداية الملف في الأغنية الكاملة؛ كل التوقيتات هنا بتوقيت الأغنية */
  offset?: number
  /** صورة الفيديو، أو لا شيء في الاختبار */
  thumb?: string
  /** شكل الموجة المحسوب مسبقاً */
  peaks?: number[]
  start: number
  end: number
  index?: number
  autoPlay?: boolean
  ctl: RefObject<ClipControl | null>
  onStart: () => void
  onError: (msg: string) => void
}

/** مشغّل صوت المقطع بشكل أسطوانة تخرج من غلافها وتدور، وتحتها موجة المقطع تمتلئ من اليمين */
export function AudioClip({ src, offset = 0, thumb, peaks, start, end, index, autoPlay, ctl, onStart, onError }: Props) {
  const audio = useRef<HTMLAudioElement>(null)
  const range = useRef({ start, end })
  const [t, setT] = useState(start)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [started, setStarted] = useState(false)
  const settings = useClipSettings()
  // موضع التشغيل بتوقيت الأغنية الكاملة
  const pos = (a: HTMLAudioElement) => a.currentTime + offset
  const go = (a: HTMLAudioElement, s: number) => {
    a.currentTime = Math.max(0, s - offset)
    setT(s)
  }

  const playFrom = (s: number, e: number) => {
    const a = audio.current
    if (!a) return
    range.current = { start: s, end: e }
    go(a, s)
    resume()
  }

  const resume = () => {
    const a = audio.current
    if (!a) return
    claimAudio(a)
    applyClipSettings(a)
    engine.stopAll()
    setStarted(true)
    onStart()
    a.play().catch(() => setPlaying(false))
  }

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (!a.paused) return a.pause()
    const { start: s, end: e } = range.current
    if (!started || pos(a) >= e - 0.25 || pos(a) < s) playFrom(s, e)
    else resume()
  }

  useImperativeHandle(ctl, () => ({
    replay: playFrom,
    now: () => (audio.current ? pos(audio.current) : 0),
  }))

  // تغيير السرعة أو الصوت أثناء التشغيل
  useEffect(() => {
    if (started && audio.current) applyClipSettings(audio.current)
  }, [settings, started])

  // تغيّر التوقيت من وضع التعديل
  useEffect(() => {
    range.current = { start, end }
  }, [start, end])

  useEffect(() => {
    if (autoPlay) playFrom(start, end)
    // مرة واحدة عند الظهور
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحديث الموجة بسلاسة، والتوقف عند نهاية المقطع
  useEffect(() => {
    if (!playing) return
    let id = 0
    const tick = () => {
      const a = audio.current
      if (!a) return
      if (pos(a) >= range.current.end) {
        a.pause()
        setT(range.current.end)
        return
      }
      setT(pos(a))
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])

  const len = Math.max(1, end - start)
  const frac = Math.min(1, Math.max(0, (t - start) / len))
  const bars = peaks ?? Array.from({ length: 48 }, () => 30)

  // الموجة من اليمين إلى اليسار مثل الكتابة
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audio.current
    if (!a) return
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width))
    go(a, start + f * len)
    if (!started) resume()
  }

  return (
    <div className={`vp ${started ? 'is-started' : ''} ${playing ? 'is-playing' : ''}`}>
      <audio
        ref={audio}
        src={`${src}#t=${Math.max(0, start - offset)}`}
        // ملفات Bunny من موقع آخر: بدون هذا يصير الصوت صامتاً حين نقوّيه عبر Web Audio
        crossOrigin="anonymous"
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        // احتياط حين لا يعمل requestAnimationFrame (تبويب في الخلفية)
        onTimeUpdate={(e) => {
          if (pos(e.currentTarget) >= range.current.end) e.currentTarget.pause()
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onError={() => onError('تعذّر تحميل ملف الصوت.')}
      />
      <div className="vp-stage">
        <button type="button" className="vp-deck" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل المقطع'}>
          <span className="vp-record" aria-hidden="true">
            <span className="vp-disc">
              <span className="vp-label">{thumb && <img src={thumb} alt="" loading="lazy" />}</span>
            </span>
          </span>
          <span className="vp-sleeve" aria-hidden="true">
            {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="vp-q">؟</span>}
          </span>
        </button>
        <div className="vp-side">
          {index !== undefined && <span className="vp-num">{arNum(index, 2)}</span>}
          <button type="button" className="vp-play" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل المقطع'}>
            {waiting && playing ? (
              <span className="clip-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}
              </svg>
            )}
          </button>
          <span className="vp-time">{started ? `${fmtTime(t - start)} / ${fmtTime(len)}` : `${fmtTime(start)}–${fmtTime(end)}`}</span>
        </div>
      </div>
      <div
        className="vp-wave"
        role="slider"
        aria-label="موضع المقطع"
        aria-valuemin={0}
        aria-valuemax={Math.round(len)}
        aria-valuenow={Math.round(t - start)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e)
        }}
        onPointerMove={(e) => e.buttons && seek(e)}
        onKeyDown={(e) => {
          const a = audio.current
          if (!a) return
          const d = e.key === 'ArrowLeft' ? 5 : e.key === 'ArrowRight' ? -5 : 0
          if (!d) return
          e.preventDefault()
          go(a, Math.min(end, Math.max(start, pos(a) + d)))
        }}
      >
        {bars.map((h, i) => (
          <span key={i} className={(i + 0.5) / bars.length <= frac ? 'on' : ''} style={{ height: `${h}%` }} />
        ))}
        {started && <span className="vp-head" style={{ right: `${frac * 100}%` }} />}
      </div>
    </div>
  )
}

const RATES = [
  { v: 1, label: 'عادي' },
  { v: 0.75, label: '¾' },
  { v: 0.5, label: '½' },
]

/** سرعة المقطع وعلوّ صوته، لكل المقاطع معاً */
export function ClipTempo() {
  const { rate, vol } = useClipSettings()
  return (
    <div className="clip-tempo">
      <div className="clip-rate" role="group" aria-label="سرعة المقطع">
        <span className="clip-tempo-label">السرعة</span>
        {RATES.map((r) => (
          <button key={r.v} type="button" className={rate === r.v ? 'is-on' : ''} aria-pressed={rate === r.v} onClick={() => setClipSettings({ rate: r.v })}>
            {r.label}
          </button>
        ))}
      </div>
      <label className="clip-vol">
        <span className="clip-tempo-label">الصوت</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={vol}
          onChange={(e) => setClipSettings({ vol: +e.target.value })}
          style={{ '--fill': `${(vol / 2) * 100}%` } as React.CSSProperties}
        />
        <span className={`clip-vol-n ${vol > 1 ? 'is-boost' : ''}`}>{arNum(Math.round(vol * 100))}٪</span>
      </label>
    </div>
  )
}
