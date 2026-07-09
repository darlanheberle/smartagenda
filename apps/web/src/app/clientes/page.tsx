import { ClientRecord, ClientesView } from "../components/clientes-view";
import { fetchJson, requireAccount } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const { account, cookieHeader } = await requireAccount("/clientes");
  const clients = await fetchJson<ClientRecord[]>("/clients", [], cookieHeader);

  return <ClientesView account={account} clients={clients} />;
}
