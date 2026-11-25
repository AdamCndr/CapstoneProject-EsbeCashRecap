import { useCallback, useEffect, useRef, useState } from 'react';

/** Port React dari composable Vue `usePollingInterval`.
 *  Callback selalu diambil dari ref terbaru, jadi tidak perlu mengulang interval
 *  setiap kali fungsi callback berubah.
 */
export function usePollingInterval(callback, options = {}) {
  const {
    interval = 600000, // 10 menit
    immediate = true,
    enabled = true,
  } = options;

  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const [isActive, setIsActive] = useState(enabled);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const runPolling = useCallback(() => {
    void Promise.resolve(callbackRef.current()).catch((error) => {
      console.error('[usePollingInterval] callback error:', error);
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setIsActive(true);
    timerRef.current = setInterval(runPolling, interval);
  }, [interval, runPolling, stopPolling]);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return undefined;
    }
    startPolling();
    if (immediate) runPolling();
    return stopPolling;
  }, [enabled, immediate, startPolling, runPolling, stopPolling]);

  return { isActive: enabled && isActive, runPolling, startPolling, stopPolling };
}
