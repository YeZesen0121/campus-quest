import type { Metadata } from "next";
import { ProjectDraftsView } from "@/features/innovation/ProjectDraftsView";
import { PrivatePage } from "@/features/innovation/PrivateWorkspace";
export const metadata: Metadata = { title: "我的项目 · 华师令", description: "准备仅自己可见的创新创业项目概况" };
export default function Page() { return <PrivatePage><ProjectDraftsView /></PrivatePage>; }
