import Link from "next/link";
import type { Metadata } from "next";

import { PasswordResetForm } from "@/features/auth/PasswordResetForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "找回密码 · 华师令",
  description: "通过绑定手机号的验证码重置 CampusQuest 密码",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPage title="找回密码" kicker="校内空间"
      description="通过绑定手机号验证，重新设置密码。"
      links={<>
        <Link className="link" href="/login">
          想起密码了，返回登录
        </Link>
      </>}>
      <PasswordResetForm />
    </AuthPage>
  );
}
