import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "导师登录 · CampusQuest",
  description: "登录并确认、维护本人的导师档案",
};

export default function MentorLoginPage() {
  return (
    <>
      <div className="auth-head">
        <h1 className="auth-title">导师登录</h1>
        <p className="auth-subtitle">使用导师账号确认和维护本人的导师档案</p>
      </div>
      <LoginForm account="mentor" />
      <p className="auth-alt-action">
        已有教师任务账号？<Link className="link" href="/staff/login">使用员工登录</Link>
      </p>
      <p className="auth-alt-action">
        <Link className="link" href="/login">返回学生登录</Link>
      </p>
    </>
  );
}
