import { useEffect, useRef } from 'react'

const TURN_MS = 1800

/**
 * أسطوانة بأخاديد وملصق في الوسط — تدور أثناء التشغيل.
 * يدور القرص والملصق فقط؛ اللمعة والظل ثابتان كما في الأسطوانة الحقيقية،
 * وعند الإيقاف تتباطأ من زاويتها الحالية بدل أن تقفز إلى الصفر.
 */
export function Disc({ label, sub, spinning, className = '' }: { label?: string; sub?: string; spinning?: boolean; className?: string }) {
  const spinRef = useRef<SVGGElement>(null)
  const angle = useRef(0)
  const anim = useRef<Animation | null>(null)

  useEffect(() => {
    const el = spinRef.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (spinning) {
      const a = angle.current
      anim.current?.cancel()
      // دورة أولى تتسارع، ثم دوران ثابت
      const spinUp = el.animate([{ transform: `rotate(${a}deg)` }, { transform: `rotate(${a + 180}deg)` }], {
        duration: TURN_MS,
        easing: 'cubic-bezier(.5,0,1,1)',
      })
      anim.current = spinUp
      spinUp.onfinish = () => {
        if (anim.current !== spinUp) return
        angle.current = (a + 180) % 360
        const b = angle.current
        anim.current = el.animate([{ transform: `rotate(${b}deg)` }, { transform: `rotate(${b + 360}deg)` }], {
          duration: TURN_MS,
          iterations: Infinity,
        })
      }
    } else if (anim.current) {
      const cur = currentAngle(el)
      anim.current.cancel()
      const end = cur + 120
      anim.current = el.animate([{ transform: `rotate(${cur}deg)` }, { transform: `rotate(${end}deg)` }], {
        duration: 1100,
        easing: 'cubic-bezier(.15,.6,.3,1)',
        fill: 'forwards',
      })
      angle.current = end % 360
    }
  }, [spinning])

  useEffect(() => () => anim.current?.cancel(), [])

  return (
    <svg className={`disc ${spinning ? 'spinning' : ''} ${className}`} viewBox="0 0 200 200" aria-hidden="true">
      <g className="disc-tilt">
        <g ref={spinRef} className="disc-spin">
          <circle cx="100" cy="100" r="99" className="disc-vinyl" />
          {[92, 86, 80, 74, 68, 62, 56, 50].map((r) => (
            <circle key={r} cx="100" cy="100" r={r} className="disc-groove" />
          ))}
          <circle cx="100" cy="100" r="40" className="disc-label" />
          <circle cx="100" cy="100" r="34" className="disc-label-ring" />
          {label && (
            <text x="100" y={sub ? 93 : 108} className="disc-text">
              {label}
            </text>
          )}
          {sub && (
            <text x="100" y="121" className="disc-sub">
              {sub}
            </text>
          )}
          <circle cx="100" cy="100" r="3.5" className="disc-hole" />
        </g>
      </g>
      <path d="M100 8 A92 92 0 0 1 178 52" className="disc-shine" />
    </svg>
  )
}

/** الزاوية الحالية للعنصر من مصفوفة التحويل */
function currentAngle(el: Element) {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  const m = new DOMMatrixReadOnly(t)
  return (Math.atan2(m.b, m.a) * 180) / Math.PI
}

/** نجمة ثمانية (خاتم) للزخرفة */
export function Star({ className = '' }: { className?: string }) {
  return (
    <svg className={`star ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" />
    </svg>
  )
}
