import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave(save: () => Promise<void>, delay = 800) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const run = useCallback(async () => {
    setStatus('saving');
    try {
      await saveRef.current();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, []);

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(run, delay);
  }, [delay, run]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await run();
  }, [run]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { status, trigger, flush };
}
