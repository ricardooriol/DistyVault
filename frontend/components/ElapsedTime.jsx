import React, { useState, useEffect } from 'react';

export function ElapsedTime({ start }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(start).getTime()) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [start]);
  
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return <span>{mins}:{secs.toString().padStart(2, '0')}</span>;
}
