import type { ReactNode } from "react";
import { CampusShell } from "./_components/CampusShell";
export default function CampusLayout({ children }: { children: ReactNode }) { return <CampusShell>{children}</CampusShell>; }
