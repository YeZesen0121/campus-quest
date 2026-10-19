import type { Metadata } from "next";
import { TalentProfileView } from "@/features/innovation/TalentProfileView";
import { PrivatePage } from "@/features/innovation/PrivateWorkspace";
export const metadata: Metadata = { title: "我的人才档案 · 华师令" };
export default function Page() { return <PrivatePage><TalentProfileView /></PrivatePage>; }
