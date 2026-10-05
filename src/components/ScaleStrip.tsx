import { Fragment } from 'react'
import { intervalShort, intervalLabel, noteCents, traditionalName } from '../data/notes'
import { AJNAS_BY_ID } from '../data/ajnas'
import type { JinsPlacement } from '../data/maqamat'
import { NoteName } from './NoteName'

interface Props {
  notes: string[]
  ajnas?: JinsPlacement[]
  ghammaz?: number
  litDegree?: number | null
  showTraditional?: boolean
  onNote?: (i: number) => void
  onJins?: (j: JinsPlacement, index: number) => void
}

/** شريط يعرض نغمات المقام والمسافات بينها والأجناس فوقها */
export function ScaleStrip({ notes, ajnas = [], ghammaz, litDegree, showTraditional = true, onNote, onJins }: Props) {
  const cols = notes.length * 2 - 1
  return (
    <div className="strip-scroll">
      <div className="strip" dir="ltr" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {ajnas.map((j, k) => {
          const jins = AJNAS_BY_ID[j.jins]
          const from = j.at * 2 + 1
          const to = Math.min(cols, (j.at + j.length - 1) * 2 + 1) + 1
          return (
            <button
              key={k}
              type="button"
              className={`jins-bar jins-${k}`}
              style={{ gridColumn: `${from} / ${to}`, gridRow: (k % 2) + 1 }}
              onClick={() => onJins?.(j, k)}
              title="اضغط لسماع الجنس"
            >
              <span dir="rtl">
                جنس {j.label ?? jins.name} على <NoteName note={notes[j.at]} />
              </span>
            </button>
          )
        })}
        {notes.map((n, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="interval" style={{ gridRow: 3 }} title={intervalLabel(noteCents(n) - noteCents(notes[i - 1]))}>
                {intervalShort(noteCents(n) - noteCents(notes[i - 1]))}
              </div>
            )}
            <button
              type="button"
              className={`chip ${i === 0 ? 'is-tonic' : ''} ${i === ghammaz ? 'is-ghammaz' : ''} ${litDegree === i ? 'lit' : ''}`}
              style={{ gridRow: 3 }}
              onClick={() => onNote?.(i)}
            >
              <span className="chip-name">
                <NoteName note={n} />
              </span>
              {showTraditional && traditionalName(n) && <span className="chip-trad">{traditionalName(n)}</span>}
              <span className="chip-deg">{i === 0 ? 'القرار' : i === ghammaz ? 'الغمّاز' : i + 1}</span>
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
