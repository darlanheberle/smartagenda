import { ConfiguracoesClient } from "./configuracoes-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const { account } = await getPanelData();

  return <ConfiguracoesClient account={account} />;
}
