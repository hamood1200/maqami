import { parseNote, LETTER_AR, type Accidental } from '../data/notes'

export function AccGlyph({ acc }: { acc: Accidental }) {
  if (!acc) return null
  if (acc === 'b') return <span className="acc">♭</span>
  if (acc === '#') return <span className="acc">♯</span>
  if (acc === 'hb')
    // نصف بيمول: بيمول مشطوب كما في التدوين العربي
    return (
      <svg className="acc acc-svg" viewBox="0 0 12 24" aria-label="نصف بيمول" role="img">
        <path d="M4 1 V20" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M4 20 C 11 16, 11 9, 4 13" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M1 9 L9 5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  // نصف دييز
  return (
    <svg className="acc acc-svg" viewBox="0 0 12 24" aria-label="نصف دييز" role="img">
      <path d="M6 2 V22" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 10 L10 8 M2 16 L10 14" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function NoteName({ note }: { note: string }) {
  const p = parseNote(note)
  return (
    <span className="note-name">
      {LETTER_AR[p.letter]}
      <bdi dir="ltr">
        <AccGlyph acc={p.acc} />
      </bdi>
    </span>
  )
}
