import { useCallback, useEffect, useState } from 'react'
import { loadGameData } from '@/data/load'
import type { GameData } from '@/data/types'

export type GameDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: GameData }
  | { status: 'error'; error: unknown }

export function useGameData(): [GameDataState, () => void] {
  const [state, setState] = useState<GameDataState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadGameData(import.meta.env.BASE_URL).then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (error: unknown) => !cancelled && setState({ status: 'error', error }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])
  return [state, retry]
}
