import { useCallback, useEffect, useRef, useState } from 'react';

/** Port React dari composable Vue `useTimedMessage`.
 *  Nilai bisa berupa string maupun objek (mis. `{ type, message }`).
 *  Timer selalu dibersihkan saat unmount atau saat pesan baru muncul.
 */
export function useTimedMessage(initialValue = '', defaultDuration = 3000) {
  const [message, setMessage] = useState(initialValue);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearMessage = useCallback(() => {
    clearTimer();
    setMessage('');
  }, [clearTimer]);

  const showMessage = useCallback(
    (value, duration = defaultDuration) => {
      clearTimer();
      setMessage(value);
      if (!value) return;
      if (typeof value === 'object' && !value.message && !value.title) return;

      timerRef.current = setTimeout(() => {
        setMessage(initialValue);
        timerRef.current = null;
      }, duration);
    },
    [clearTimer, defaultDuration, initialValue],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { message, showMessage, clearMessage, clearTimer };
}
