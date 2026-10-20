import Link from "next/link";
import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/AuthPage";
import { UnifiedLoginPanel } from "@/features/auth/UnifiedLoginPanel";

export const metadata: Metadata = {
  title: "登录 · 华师令",
  description: "使用手机号、邮箱或学号登录华师令",
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <AuthPage title="登录华师令" kicker="校内空间"
      description="使用手机号、邮箱或学号，继续你的校园实践。"
      links={<>
        <Link href="/register">首次使用，注册学生账号</Link>
        <Link href="/forgot-password">忘记密码</Link>
        <Link href="/mentor/login">导师入口</Link>
      </>}>
      {params.reset === "1" ? (
        <div className="alert alert-success" role="status">
          <p>密码已重置，请使用新密码登录</p>
        </div>
      ) : null}
      <UnifiedLoginPanel />
    </AuthPage>
  );
}
