import type { Metadata } from "next";
import { OwnerProfileView } from "@/features/innovation/OwnerProfileView";
import { PrivatePage } from "@/features/innovation/PrivateWorkspace";
export const metadata: Metadata = { title: "负责人资料与资格 · 华师令", description: "准备本人创新创业项目负责人资料" };
export default function Page() { return <PrivatePage><OwnerProfileView /></PrivatePage>; }
