import type { ReactNode } from "react";
import { PanelShell } from "./components/panel-shell";
import { getPanelData } from "./lib/data";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const data = await getPanelData();

  return (
    <PanelShell account={data.account} onboarding={data.onboarding}>
      {children}
    </PanelShell>
  );
}
