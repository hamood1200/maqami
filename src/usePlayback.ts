import { useCallback, useEffect, useState } from 'react'
import { engine, type SeqEvent } from './audio/engine'

/** يشغّل تتابع نغمات ويتتبّع النغمة الحالية لإضاءتها على اللوحة والشريط */
export function usePlayback() {
  const [playing, setPlaying] = useState<string | null>(null)
  const [litDegree, setLitDegree] = useState<number | null>(null)
  const [lit, setLit] = useState<Set<number>>(new Set())

  const stop = useCallback(() => {
    engine.stopSequence()
    setPlaying(null)
    setLitDegree(null)
    setLit(new Set())
  }, [])

  const play = useCallback((id: string, events: SeqEvent[]) => {
    engine.playSequence(
      events,
      (tag, i) => {
        setLitDegree(tag ?? null)
        setLit(new Set([events[i].cents]))
      },
      () => {
        setPlaying(null)
        setLitDegree(null)
        setLit(new Set())
      },
    )
    setPlaying(id)
  }, [])

  // إيقاف الصوت عند مغادرة الصفحة
  useEffect(() => () => engine.stopSequence(), [])

  return { playing, litDegree, lit, play, stop }
}
