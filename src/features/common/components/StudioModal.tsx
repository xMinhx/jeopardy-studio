import { useEffect } from "react";

interface StudioModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "alert" | "confirm";
}

/**
 * A premium, studio-themed modal replacement for window.alert and window.confirm.
 */
export function StudioModal({ 
  isOpen, title, message, onConfirm, onCancel, 
  confirmText = "Confirm", cancelText = "Cancel", 
  type = "confirm" 
}: StudioModalProps) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel?.(); };
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#05070a]/80 backdrop-blur-md" onClick={onCancel} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md studio-card p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] border-[--border-strong] anim-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--border-subtle] bg-[--surface-overlay]">
          <div className="flex items-center gap-2">
            <span className="text-[--gold] text-[10px] tracking-[0.2em] font-black uppercase">◈ Studio Dialog</span>
          </div>
          <button onClick={onCancel} className="text-[--text-muted] hover:text-[--text-primary] transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <h3 className="font-serif text-2xl mb-3 text-[--gold] tracking-wide">{title}</h3>
          <p className="text-[--text-secondary] leading-relaxed text-sm">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 bg-[--surface-base] border-t border-[--border-subtle]">
          {type === "confirm" && (
            <button 
              className="flex-1 btn-neutral py-2.5"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button 
            className="flex-1 btn-gold py-2.5"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
