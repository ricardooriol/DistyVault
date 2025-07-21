'use client'

import { useState, useEffect } from 'react'

export function ElapsedTime({ 
  start, 
  status 
}: { 
  start: string, 
  status: string 
}) {
  const [elapsed, setElapsed] = useState('0s')

  useEffect(() => {
    const updateElapsed = () => {
      const startTime = new Date(start).getTime()
      const now = Date.now()
      const diff = now - startTime
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        setElapsed(`${hours}h ${minutes % 60}m`)
      } else if (minutes > 0) {
        setElapsed(`${minutes}m ${seconds % 60}s`)
      } else {
        setElapsed(`${seconds}s`)
      }
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [start])

  return status === 'done' || status === 'stopped' ? elapsed : `${elapsed}...`
}
