import { AgendaClient } from "./agenda-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { account, appointments, availabilityRules, services, teamMode, teamMembers } =
    await getPanelData();

  return (
    <AgendaClient
      appointments={appointments}
      availabilityRules={availabilityRules}
      services={services}
      teamMode={teamMode}
      teamMembers={teamMembers}
      isTeamMember={account.role === "team_member"}
    />
  );
}
