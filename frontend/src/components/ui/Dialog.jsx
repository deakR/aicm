import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 app-dialog-backdrop"
        aria-label="Close dialog"
        onClick={() => {
          if (closeOnBackdrop) {
            onClose?.();
          }
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={cx(
          'relative z-[121] w-full app-dialog-panel',
          SIZE_CLASS[size] || SIZE_CLASS.md,
        )}
      >
        {(title || description) && (
          <header className="app-dialog-header">
            <div>
              {title ? <h2 className="app-dialog-title">{title}</h2> : null}
              {description ? <p className="app-dialog-description">{description}</p> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
              Close
            </Button>
          </header>
        )}

        <div className="app-dialog-body">{children}</div>

        {footer ? <footer className="app-dialog-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
