import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "注册 · 华师令",
  description: "使用学号与手机验证码注册学生账号，密码可选，注册后待管理员审核",
};

export default function RegisterPage() {
  return (
    <AuthPage title="注册学生账号" kicker="校内空间"
      description="使用学号与手机验证码注册；注册后待管理员审核。"
      links={<Link href="/login">已有账号，返回登录</Link>}>
      <RegisterForm />
    </AuthPage>
  );
}
