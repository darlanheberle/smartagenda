import { AgendaClient } from "./agenda-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { appointments, availabilityRules, services } = await getPanelData();

  return <AgendaClient appointments={appointments} availabilityRules={availabilityRules} services={services} />;
}
