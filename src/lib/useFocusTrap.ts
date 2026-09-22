import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into an open overlay, cycles Tab inside it, and returns focus
 * to whatever had focus before it opened.
 *
 * WAI-ARIA dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement as HTMLElement | null;

    // Wait a frame so the overlay is laid out before we move focus into it.
    const frame = requestAnimationFrame(() => {
      const target =
        node.querySelector<HTMLElement>('[data-autofocus]') ||
        node.querySelector<HTMLElement>(FOCUSABLE) ||
        node;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const nodes = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      const items: HTMLElement[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el.getClientRects().length > 0 && !el.hasAttribute('aria-hidden')) {
          items.push(el);
        }
      }

      if (items.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !node.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      if (opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active, ref]);
}