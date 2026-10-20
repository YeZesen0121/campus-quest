import type { Metadata } from "next";

import { StaffInviteAccept } from "@/features/auth/StaffInviteAccept";

export const metadata: Metadata = {
  title: "接受员工邀请 · 华师令",
  description: "教师设置密码（可选）即完成激活；管理员设置密码并绑定动态口令（TOTP）",
};

interface StaffInvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Staff invitation acceptance (spec §5.8 steps 1-5; V1.1 §2.3).
 *
 * Server shell only: the token route param flows straight into the client
 * island. The token is a single-use secret — it is never logged and never
 * rendered back to the user.
 */
export default async function StaffInvitePage({ params }: StaffInvitePageProps) {
  const { token } = await params;

  return <StaffInviteAccept token={token} />;
}
