import Link from "next/link";
import type { Metadata } from "next";

import { StaffLoginForm } from "@/features/auth/StaffLoginForm";
import { AuthPage } from "@/features/auth/AuthPage";

export const metadata: Metadata = {
  title: "员工登录 · 华师令",
  description: "使用员工邮箱、密码和动态口令登录 CampusQuest",
};

/**
 * Staff login (spec §5.8): its OWN route and form — the staff email
 * identifier never merges into the student student-number login
 * (task brief step 3: no ambiguous identifier parser).
 */
export default function StaffLoginPage() {
  return (
    <AuthPage title="员工登录" kicker="教师与管理员"
      description="使用员工邮箱、密码和动态验证码登录。"
      links={<p className="auth-alt-action">
        <Link className="link" href="/login">
          学生入口：使用学号登录
        </Link>
      </p>}>
      <p className="auth-brief">教师与管理员使用独立员工账号登录。</p>
      <StaffLoginForm />
    </AuthPage>
  );
}
