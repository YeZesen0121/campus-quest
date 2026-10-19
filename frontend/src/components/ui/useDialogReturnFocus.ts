"use client";

import { useRef } from "react";

/** For controlled dialogs whose opener lives outside the Radix Root. */
export function useDialogReturnFocus(
  currentActor: () => unknown,
  fallback?: () => HTMLElement | null,
) {
  const opener = useRef<{ element: HTMLElement; actor: unknown } | null>(null);
  return {
    onOpenAutoFocus() {
      opener.current = document.activeElement instanceof HTMLElement
        ? { element: document.activeElement, actor: currentActor() }
        : null;
    },
    onCloseAutoFocus(event: Event) {
      event.preventDefault();
      const previous = opener.current;
      if (!previous || !Object.is(previous.actor, currentActor())) return;
      const target = previous.element.isConnected && !previous.element.matches(":disabled")
        ? previous.element
        : fallback?.();
      if (target?.isConnected && !target.matches(":disabled")) target.focus();
    },
  };
}
