import type { ReactNode } from "react";
import { AuthFrame } from "@/features/auth/AuthFrame";

/**
 * Auth route-group shell: a Server Component frame (patterns §2) that
 * carries the approved brand/header and reading column; every page keeps
 * its own heading, card composition and Client form
 * island. Authentication pages stay visually serious (design system §2).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthFrame>{children}</AuthFrame>
  );
}
