import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { classNames } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = overlayRef.current;
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    root?.querySelector<HTMLElement>(selector)?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !root) return;
      const targets = [...root.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length > 0);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "تفاصيل"}
        className={classNames(
          'relative w-full max-w-lg rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          {title && <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>}
          <button
            aria-label="إغلاق"
            onClick={onClose}
            className="mr-auto rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--color-text-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
