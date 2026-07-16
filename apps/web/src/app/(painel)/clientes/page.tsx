import { ClientesClient } from "./clientes-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const { clients } = await getPanelData();

  return <ClientesClient clients={clients} />;
}
