import { AgendaAppointment, AgendaView } from "../components/agenda-view";
import { fetchJson, requireAccount } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { account, cookieHeader } = await requireAccount("/agenda");
  const appointments = await fetchJson<AgendaAppointment[]>(
    "/appointments/upcoming?limit=100",
    [],
    cookieHeader
  );

  return <AgendaView account={account} appointments={appointments} />;
}
