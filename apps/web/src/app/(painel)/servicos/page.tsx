import { ServicosClient } from "./servicos-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const { account, services, teamMode, teamMembers } = await getPanelData();

  return (
    <ServicosClient
      initialServices={services}
      initialTeamMode={teamMode}
      initialTeamMembers={teamMembers}
      companySlug={account.slug || undefined}
    />
  );
}
