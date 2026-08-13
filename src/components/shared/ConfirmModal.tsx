import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  const iconMap = {
    danger: <Trash2 size={22} />,
    warning: <AlertTriangle size={22} />,
    default: <AlertTriangle size={22} />,
  };

  const iconBgMap = {
    danger: 'bg-white/5 text-gray-400',
    warning: 'bg-blue-500/10 text-blue-400',
    default: 'bg-blue-500/10 text-blue-400',
  };

  const confirmBtnMap = {
    danger: 'bg-white/10 hover:bg-white/15 border border-white/10 text-white',
    warning: 'bg-blue-500 hover:bg-blue-600 text-white',
    default: 'bg-blue-500 hover:bg-blue-600 text-white',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-[#111111] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBgMap[variant]}`}>
                  {iconMap[variant]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
                </div>
                <button
                  onClick={onCancel}
                  className="flex-shrink-0 p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 pb-6">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${confirmBtnMap[variant]}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
