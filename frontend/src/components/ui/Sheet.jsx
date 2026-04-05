import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SIDE_CLASS = {
  left: 'left-0 h-full w-[86vw] max-w-[360px] translate-x-0',
  right: 'right-0 h-full w-[86vw] max-w-[360px] translate-x-0',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Sheet({
  open,
  onClose,
  side = 'left',
  title,
  children,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        className="absolute inset-0 app-sheet-backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Menu'}
        className={cx('absolute app-sheet-panel', SIDE_CLASS[side] || SIDE_CLASS.left)}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
