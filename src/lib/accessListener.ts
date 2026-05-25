import { useEffect, useRef } from 'react';

// Web Audio API beep generator
export function playBeep(type: 'success' | 'error') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Low pitch A3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Web Audio API not supported or blocked by browser policy:", e);
  }
}

export function useRfidScanner(onScan: (uid: string) => void) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys inside input, textarea or select fields to avoid intercepting manual inputs
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If keys are pressed slowly (> 120ms), it's manual typing, reset buffer
      // (Unless it's the very first character of the buffer)
      if (bufferRef.current.length > 0 && diff > 120) {
        bufferRef.current = '';
      }

      const key = e.key;

      if (key === 'Enter') {
        const val = bufferRef.current.trim();
        // RFID card UIDs are usually numeric, sometimes hex, let's accept alphanumeric >= 4 chars
        if (val.length >= 4) {
          e.preventDefault();
          onScan(val);
        }
        bufferRef.current = '';
      } else if (/^[a-zA-Z0-9]$/.test(key)) {
        bufferRef.current += key;
      } else {
        // Any other character resets the buffer
        bufferRef.current = '';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan]);
}
