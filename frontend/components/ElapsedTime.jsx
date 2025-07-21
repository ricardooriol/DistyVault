import React, { useState, useEffect, useRef } from 'react';

export function ElapsedTime({ start, status }) {
  const [elapsed, setElapsed] = useState(0);
  const finalElapsedRef = useRef(null);
  
  useEffect(() => {
    // If we already have a final value and the status is done/stopped, use that
    if ((status === 'done' || status === 'stopped') && finalElapsedRef.current !== null) {
      setElapsed(finalElapsedRef.current);
      return;
    }

    const update = () => {
      const newElapsed = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
      setElapsed(newElapsed);
      
      // If status is done/stopped, store the final value
      if (status === 'done' || status === 'stopped') {
        finalElapsedRef.current = newElapsed;
      }
    };

    update();

    // Only set up interval if status is not 'done' or 'stopped'
    if (status !== 'done' && status !== 'stopped') {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [start, status]);
  
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return <span>{mins}:{secs.toString().padStart(2, '0')}</span>;
}
