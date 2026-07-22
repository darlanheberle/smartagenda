import { IAClient } from "./ia-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function IAPage() {
  const { account, apiUrl, appointments, clients, dashboard, onboarding } = await getPanelData();

  return (
    <IAClient
      apiUrl={apiUrl}
      appointments={appointments}
      clients={clients}
      dashboard={dashboard}
      initialEnabled={account.aiEnabled !== false}
      ready={onboarding.ready}
      whatsappConnected={onboarding.whatsappConnected}
    />
  );
}
