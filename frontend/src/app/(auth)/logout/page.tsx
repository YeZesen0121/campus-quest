import type { Metadata } from "next";
import { LogoutView } from "@/features/auth/LogoutView";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = { title: "退出登录 · 华师令" };
export default function LogoutPage() {
  return <AuthPage title="退出当前账号" kicker="校内空间" description="退出前，请确认当前操作已保存。"><LogoutView /></AuthPage>;
}
