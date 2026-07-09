import { FinanceAppointment, FinanceiroView } from "../components/financeiro-view";
import { fetchJson, requireAccount } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const { account, cookieHeader } = await requireAccount("/financeiro");
  const appointments = await fetchJson<FinanceAppointment[]>(
    "/appointments?limit=200",
    [],
    cookieHeader
  );

  return <FinanceiroView account={account} appointments={appointments} />;
}
