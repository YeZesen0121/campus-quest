"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"textarea">, "defaultValue" | "value"> & { value: string };

function fit(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  const style = getComputedStyle(element);
  const minimum = Number.parseFloat(style.minHeight) || 0;
  const maximum = Number.parseFloat(style.maxHeight);
  const border = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  element.style.height = `${Math.max(minimum, Math.min(Number.isFinite(maximum) ? maximum : Infinity, element.scrollHeight + border))}px`;
}

/** Native controlled field; CSS owns the size bounds and its parent owns the value. */
export function BoundedTextarea({ value, rows = 2, ...props }: Props) {
  const node = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { if (node.current) fit(node.current); }, [value]);
  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    let active = true;
    let width: number | undefined;
    const update = () => { if (active) fit(element); };
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().width;
      // A user resizing only the height keeps that choice until the next edit.
      if (next === width) return;
      width = next; update();
    });
    observer.observe(element);
    document.fonts.addEventListener("loadingdone", update);
    void document.fonts.ready.then(update);
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", update); };
  }, []);
  return <textarea {...props} rows={rows} value={value} ref={node} />;
}
