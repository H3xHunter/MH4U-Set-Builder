import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Dev-only: `import.meta.env.DEV` is replaced by `false` in the build, so the chunk is dropped.
const IconGallery = import.meta.env.DEV ? lazy(() => import('./dev/IconGallery')) : null
const SkillGallery = import.meta.env.DEV ? lazy(() => import('./dev/SkillGallery')) : null
const Gallery = location.hash === '#icons' ? IconGallery : location.hash === '#skills' ? SkillGallery : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Gallery ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
