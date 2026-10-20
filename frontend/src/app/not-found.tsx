import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "页面不存在 · 华师令",
};

/**
 * The custom 404 (audit item B; owner feedback 2026-10-15): the product
 * speaks Chinese everywhere except the router's default English
 * not-found page. Minimal shell, the honest copy, and a way home —
 * the home link re-enters the role-aware shell flow (a staff visitor
 * is redirected onward from there by the audit-item-A fix).
 */
export default function NotFound() {
  return (
    <AuthFrame>
      <AuthPage title="页面不存在" description="你访问的页面不存在或已被移动。">
        <div className="auth-actions">
          <Button asChild><Link href="/">返回首页</Link></Button>
        </div>
      </AuthPage>
    </AuthFrame>
  );
}
