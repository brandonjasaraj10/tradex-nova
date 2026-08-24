import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

/*
  One-way messages - "that worked", "that failed" - shown in the app's own
  styling.

  These were browser alert() calls. A native dialog is drawn by the operating
  system, so it cannot be styled, it blocks the whole page until dismissed,
  and it looks like it came from the browser rather than from TradeX - which
  is exactly the wrong impression right after someone has paid, imported
  their trades, or cancelled a subscription.

  ConfirmModal already covers the other half of this: questions that need an
  answer before something irreversible happens. This covers statements, which
  need no answer and should not block anything.
*/

export type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextType {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Long enough to read a sentence without rushing, short enough not to linger.
// Errors stay longer because they usually carry something to act on.
const DISMISS_AFTER = { success: 4000, error: 7000 } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DISMISS_AFTER[tone]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-[min(24rem,calc(100vw-2rem))]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              /*
                Blue for good news, grey for bad - the same rule the rest of
                the app follows for gains and losses. Deliberately not red:
                red is reserved for genuinely destructive actions like account
                deletion, and a failed image upload is not that.
              */
              toast.tone === 'success'
                ? 'bg-[#0A0A0A]/95 border-blue-400/30 text-blue-100'
                : 'bg-[#0A0A0A]/95 border-gray-500/40 text-gray-200'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
