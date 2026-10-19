import type { Metadata } from "next";
import { OperationsGrantAdmin } from "@/features/innovation/OperationsGrantAdmin";

export const metadata: Metadata = { title: "双创运营授权 · CampusQuest 管理后台" };

export default function InnovationOperationsPage() {
  return <>
    <div className="page-head">
      <h1 className="page-title">双创运营授权</h1>
      <p className="page-subtitle">选择账号，读取当前授权后授予或撤回。</p>
    </div>
    <OperationsGrantAdmin />
  </>;
}
