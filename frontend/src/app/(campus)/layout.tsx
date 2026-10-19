import type { ReactNode } from "react";
import { CampusShell } from "@/features/innovation/CampusShell";
export default function CampusLayout({ children }: { children: ReactNode }) { return <CampusShell>{children}</CampusShell>; }
