import { TIMBRES, type Timbre } from '../audio/engine'
import { setSettings, useSettings } from '../store'

export function SoundSettings() {
  const s = useSettings()
  return (
    <div className="sound-settings">
      <label className="field">
        <span>الصوت</span>
        <select value={s.timbre} onChange={(e) => setSettings({ timbre: e.target.value as Timbre })}>
          {TIMBRES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>السرعة</span>
        <input type="range" min={50} max={180} step={2} value={s.bpm} onChange={(e) => setSettings({ bpm: +e.target.value })} />
      </label>
      <label className="field">
        <span>مستوى الصوت</span>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => setSettings({ volume: +e.target.value })} />
      </label>
    </div>
  )
}
