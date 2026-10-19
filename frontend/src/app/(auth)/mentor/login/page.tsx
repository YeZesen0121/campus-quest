import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/LoginForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "导师登录 · 华师令",
  description: "登录并确认、维护本人的导师档案",
};

export default function MentorLoginPage() {
  return (
    <AuthPage title="导师登录" kicker="导师工作区" layout="plain"
      description="使用导师账号确认与管理本人的导师档案。">
      <LoginForm account="mentor" />
      <div className="auth-mentor-links">
      <p className="auth-alt-action">
        已有教师任务账号？<Link className="link" href="/staff/login">使用员工登录</Link>
      </p>
      <p className="auth-alt-action">
        <Link className="link" href="/login">返回学生登录</Link>
      </p>
      </div>
      <p className="field-hint">导师账号用于核对和维护本人档案。</p>
    </AuthPage>
  );
}
