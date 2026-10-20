import { redirect } from "next/navigation";

/** Student and staff authentication share the upstream unified login. */
export default function StaffLoginPage() {
  redirect("/login");
}
