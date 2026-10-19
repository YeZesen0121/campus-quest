import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Presentation only; callers own headings, fields, permissions and state. */
export function DividedSections({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('cq-divided-sections', className)}>{children}</div>;
}
