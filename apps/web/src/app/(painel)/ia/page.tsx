import { IAClient } from "./ia-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function IAPage() {
  const { appointments, clients, dashboard, onboarding } = await getPanelData();

  return <IAClient appointments={appointments} clients={clients} dashboard={dashboard} ready={onboarding.ready} />;
}
