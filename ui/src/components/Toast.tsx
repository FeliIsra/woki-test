import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onClear: () => void;
  tone?: 'success' | 'error' | 'info';
}

export function Toast({ message, onClear, tone = 'info' }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const handle = setTimeout(onClear, 2800);
    return () => clearTimeout(handle);
  }, [message, onClear]);

  if (!message) return null;

  const icon = tone === 'success' ? '✅' : tone === 'error' ? '⚠️' : 'ℹ️';

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  );
}
