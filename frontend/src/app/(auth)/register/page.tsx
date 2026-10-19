import Link from "next/link";
import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/RegisterForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "注册 · 华师令",
  description: "注册 CampusQuest 学生账号（需要白名单学号和手机验证码）",
};

export default function RegisterPage() {
  return (
    <AuthPage title="注册学生账号" kicker="校内空间"
      description="完成手机号验证后，使用学号登录。"
      links={<>
        <Link className="link" href="/login">
          已有账号，返回登录
        </Link>
      </>}>
      <RegisterForm />
    </AuthPage>
  );
}
