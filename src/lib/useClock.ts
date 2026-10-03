import { useEffect, useState } from 'react'

/** Changes every minute and whenever the app returns to the foreground, so "today" rolls over at midnight. */
export function useClock(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const id = window.setInterval(bump, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && bump()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return tick
}
