import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/LoginForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "登录 · 华师令",
  description: "使用学号和密码登录华师令",
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const registered = params.registered === "1";
  const reset = params.reset === "1";

  return (
    <AuthPage title="登录华师令" kicker="校内空间"
      description="使用学号和密码，继续你的校园实践。"
      links={<>
        <Link href="/register">首次使用，注册账号</Link>
        <Link href="/staff/login">教师 / 管理员入口</Link>
        <Link href="/mentor/login">导师入口</Link>
      </>}>
      {registered ? (
        <div className="alert alert-success" role="status">
          <p>注册成功，请使用学号登录。</p>
        </div>
      ) : null}
      {reset ? (
        <div className="alert alert-success" role="status">
          <p>密码已重置，请使用新密码登录。</p>
        </div>
      ) : null}
      <LoginForm secondaryAction={<Link href="/forgot-password">忘记密码</Link>} />
    </AuthPage>
  );
}
