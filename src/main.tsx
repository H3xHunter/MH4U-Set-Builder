import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Dev-only: `import.meta.env.DEV` is replaced by `false` in the build, so the chunk is dropped.
const IconGallery = import.meta.env.DEV ? lazy(() => import('./dev/IconGallery')) : null
const showGallery = IconGallery !== null && location.hash === '#icons'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery && IconGallery ? (
      <Suspense fallback={null}>
        <IconGallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
