import { useEffect, useRef, useState } from 'react'
import type { Clip } from '../data/maqamat'
import { loadYouTube, fmtTime, type YTPlayer } from '../youtube'
import { clearOverride, effectiveClip, hasOverride, saveOverride, useClipState } from '../clips'
import { engine } from '../audio/engine'
import { arNum } from '../format'

interface Props {
  maqamId: string
  clip: Clip
  /** إخفاء اسم الأغنية (للاختبار) */
  hideMeta?: boolean
  autoPlay?: boolean
  /** رقم المقطع في القائمة */
  index?: number
}

export function ClipCard({ maqamId, clip: raw, hideMeta, autoPlay, index }: Props) {
  const { editMode } = useClipState()
  const clip = effectiveClip(maqamId, raw)
  const [active, setActive] = useState(!!autoPlay)
  const [error, setError] = useState<string | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [draft, setDraft] = useState({ start: clip.start, end: clip.end })

  useEffect(() => setDraft({ start: clip.start, end: clip.end }), [clip.start, clip.end])

  useEffect(() => {
    if (!active || !host.current) return
    let cancelled = false
    const el = document.createElement('div')
    host.current.appendChild(el)
    loadYouTube()
      .then((YT) => {
        if (cancelled) return
        player.current = new YT.Player(el, {
          videoId: clip.videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: {
            start: clip.start,
            end: clip.end,
            autoplay: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            hl: 'ar',
          },
          events: {
            onStateChange: (e) => {
              // عند تشغيل المقطع نوقف صوت الأورغ حتى لا يتداخل
              if (e.data === 1) engine.stopAll()
            },
            onError: () => setError('تعذّر تشغيل هذا الفيديو هنا. جرّب فتحه على يوتيوب.'),
          },
        })
      })
      .catch(() => setError('تعذّر الاتصال بيوتيوب. تحقق من الإنترنت.'))
    return () => {
      cancelled = true
      player.current?.destroy()
      player.current = null
      el.remove()
    }
    // نعيد إنشاء المشغّل فقط عند تغيّر الفيديو
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, clip.videoId])

  const replay = (start = clip.start, end = clip.end) => {
    if (!active) return setActive(true)
    player.current?.loadVideoById({ videoId: clip.videoId, startSeconds: start, endSeconds: end })
  }

  const now = () => Math.round(player.current?.getCurrentTime() ?? 0)
  const ytLink = `https://www.youtube.com/watch?v=${clip.videoId}&t=${clip.start}s`

  return (
    <div className="clip">
      <div className="clip-media">
        {active ? (
          <div className="clip-player" ref={host} />
        ) : (
          <button type="button" className="clip-thumb" onClick={() => setActive(true)} aria-label="تشغيل المقطع">
            {!hideMeta && <img src={`https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg`} alt="" loading="lazy" />}
            {index !== undefined && <span className="clip-num">{arNum(index, 2)}</span>}
            <span className="clip-range">
              {fmtTime(clip.start)}–{fmtTime(clip.end)}
            </span>
            <span className="clip-play">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
        {error && <div className="clip-error">{error}</div>}
      </div>
      <div className="clip-body">
        {!hideMeta && (
          <>
            <div className="clip-title">{clip.song}</div>
            <div className="clip-artist">{clip.artist}</div>
          </>
        )}
        <p className="clip-hint">{hideMeta ? 'استمع جيداً للحن… ما المقام برأيك؟' : clip.hint}</p>
        <div className="clip-actions">
          <button type="button" className="btn btn-small" onClick={() => replay()}>
            {active ? '↺ أعد المقطع' : '▶ شغّل المقطع'}
          </button>
          {!hideMeta && (
            <a className="btn btn-small btn-ghost" href={ytLink} target="_blank" rel="noreferrer">
              على يوتيوب ↗
            </a>
          )}
        </div>
        {editMode && !hideMeta && (
          <div className="clip-edit">
            <div className="clip-edit-row">
              <label>
                البداية
                <input type="number" min={0} value={draft.start} onChange={(e) => setDraft({ ...draft, start: +e.target.value })} />
              </label>
              <button type="button" className="btn btn-small" onClick={() => setDraft({ ...draft, start: now() })} disabled={!active}>
                = الآن
              </button>
              <label>
                النهاية
                <input type="number" min={0} value={draft.end} onChange={(e) => setDraft({ ...draft, end: +e.target.value })} />
              </label>
              <button type="button" className="btn btn-small" onClick={() => setDraft({ ...draft, end: now() })} disabled={!active}>
                = الآن
              </button>
            </div>
            <div className="clip-edit-row">
              <button type="button" className="btn btn-small" onClick={() => replay(draft.start, draft.end)}>
                جرّب
              </button>
              <button
                type="button"
                className="btn btn-small btn-primary"
                disabled={draft.end <= draft.start}
                onClick={() => saveOverride(maqamId, raw, draft.start, draft.end)}
              >
                حفظ التوقيت
              </button>
              {hasOverride(maqamId, raw) && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => clearOverride(maqamId, raw)}>
                  إرجاع الأصلي
                </button>
              )}
              <span className={`review-tag ${clip.needsReview ? 'warn' : 'ok'}`}>{clip.needsReview ? 'توقيت تقديري' : 'تمت المراجعة'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
