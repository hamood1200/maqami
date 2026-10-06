import { setSettings, useSettings, type Level } from '../store'

const LEVELS: { id: Level; name: string }[] = [
  { id: 'beginner', name: 'مبتدئ' },
  { id: 'advanced', name: 'متقدّم' },
]

/** التبديل بين نسخة المبتدئ والنسخة الكاملة */
export function LevelToggle() {
  const { level } = useSettings()
  return (
    <div className="level-toggle" role="radiogroup" aria-label="المستوى">
      {LEVELS.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={level === l.id ? 'on' : ''} onClick={() => setSettings({ level: l.id })}>
          {l.name}
        </button>
      ))}
    </div>
  )
}
