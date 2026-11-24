import { useState } from 'react'
import { ErrorState, LoadingState } from '@/components/layout/DataStates'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { Builder } from '@/components/layout/Builder'
import type { PlayStyle } from '@/components/layout/Segmented'
import { useGameData } from '@/state/useGameData'

export default function App() {
  const [gameData, retry] = useGameData()
  const [style, setStyle] = useState<PlayStyle>('blade')

  return (
    <div className="flex min-h-dvh flex-col">
      <Header style={style} onStyle={setStyle} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4">
        {gameData.status === 'loading' && <LoadingState />}
        {gameData.status === 'error' && <ErrorState error={gameData.error} onRetry={retry} />}
        {gameData.status === 'ready' && (
          <Builder data={gameData.data} style={style} onStyle={setStyle} />
        )}
      </main>
      <Footer />
    </div>
  )
}
