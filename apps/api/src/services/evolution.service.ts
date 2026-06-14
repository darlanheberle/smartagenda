import { Injectable } from "@nestjs/common";

type EvolutionInstance = {
  name?: string;
  instanceName?: string;
  connectionStatus?: string;
  ownerJid?: string;
  integration?: string;
  profileName?: string;
  number?: string | null;
};

@Injectable()
export class EvolutionService {
  async fetchInstances() {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !apiKey) {
      return {
        provider: "evolution-api",
        status: "missing_evolution_config",
        message: "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente."
      };
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: apiKey }
    });

    if (!response.ok) {
      return {
        provider: "evolution-api",
        status: "fetch_instances_error",
        statusCode: response.status,
        error: await response.text()
      };
    }

    const instances = (await response.json()) as EvolutionInstance[];

    return {
      provider: "evolution-api",
      status: "connected",
      instances: instances.map((instance) => ({
        name: instance.name || instance.instanceName,
        status: instance.connectionStatus,
        owner: this.maskWhatsappJid(instance.ownerJid),
        integration: instance.integration,
        profileName: instance.profileName
      }))
    };
  }

  async sendTextMessage(input: { instanceName: string; phone: string; message: string }) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !apiKey) {
      return {
        provider: "evolution-api",
        status: "mocked_until_evolution_configured",
        ...input
      };
    }

    const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${input.instanceName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        number: input.phone.replace(/\D/g, ""),
        text: input.message
      })
    });

    if (!response.ok) {
      return {
        provider: "evolution-api",
        status: "send_error",
        statusCode: response.status,
        error: await response.text(),
        ...input
      };
    }

    return {
      provider: "evolution-api",
      status: "sent",
      ...input
    };
  }

  private maskWhatsappJid(jid?: string) {
    if (!jid) {
      return undefined;
    }

    return jid.replace(/(\d{4})\d+(\d{2}@.*)/, "$1****$2");
  }
}