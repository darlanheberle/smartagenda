import { ServicosClient } from "./servicos-client";
import { getPanelData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const { services } = await getPanelData();

  return <ServicosClient initialServices={services} />;
}
