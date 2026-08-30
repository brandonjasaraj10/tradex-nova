import { useEffect } from 'react';

/*
  Holds the page still while a dialog is open.

  Without this, dragging inside a dialog scrolls the page behind it instead.
  On a phone that reads as the dialog being stuck while the background slides
  around underneath - which is how it was first reported.

  Two details worth keeping:

  - The previous value is restored rather than being reset to a hard-coded
    default, so a dialog opened from inside another dialog does not release
    the lock the outer one still needs when it closes.
  - Nothing happens while `isOpen` is false, so this is safe to call
    unconditionally at the top of a component that returns null when closed.
    Hooks cannot sit behind an early return.
*/
export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
}
