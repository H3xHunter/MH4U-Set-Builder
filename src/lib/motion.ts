const KEY = 'mh4u-set-builder:entrance-played'

/** True the first time it runs in a browser session. Evaluated once at module load, so StrictMode can't flip it. */
function firstVisit(): boolean {
  try {
    if (sessionStorage.getItem(KEY)) return false
    sessionStorage.setItem(KEY, '1')
  } catch {
    // Storage blocked: play the entrance every load rather than fail.
  }
  return true
}

export const PLAY_ENTRANCE = firstVisit()
