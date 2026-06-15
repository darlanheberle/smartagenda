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
  async prepareProfessionalInstance(input: {
    instanceName: string;
    webhookUrl: string;
    phone?: string;
  }) {
    const created = await this.createInstance(input.instanceName);
    const webhook = await this.setWebhook({
      instanceName: input.instanceName,
      webhookUrl: input.webhookUrl
    });
    const connection = await this.connectInstance(input.instanceName);

    return {
      provider: "evolution-api",
      instanceName: input.instanceName,
      phone: input.phone,
      created,
      webhook,
      connection
    };
  }

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

  async createInstance(instanceName: string) {
    const config = this.getConfig();

    if (!config) {
      return this.missingConfig();
    }

    const response = await fetch(`${config.baseUrl}/instance/create`, {
      method: "POST",
      headers: {
        apikey: config.apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    return this.parseEvolutionResponse(response, "instance_create_error");
  }

  async connectInstance(instanceName: string) {
    const config = this.getConfig();

    if (!config) {
      return this.missingConfig();
    }

    const response = await fetch(`${config.baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { apikey: config.apiKey }
    });

    return this.parseEvolutionResponse(response, "instance_connect_error");
  }

  async setWebhook(input: { instanceName: string; webhookUrl: string }) {
    const config = this.getConfig();

    if (!config) {
      return this.missingConfig();
    }

    const response = await fetch(`${config.baseUrl}/webhook/set/${input.instanceName}`, {
      method: "POST",
      headers: {
        apikey: config.apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: input.webhookUrl,
          byEvents: false,
          base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
        }
      })
    });

    return this.parseEvolutionResponse(response, "webhook_set_error");
  }

  private getConfig() {
    const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!baseUrl || !apiKey) {
      return undefined;
    }

    return { baseUrl, apiKey };
  }

  private missingConfig() {
    return {
      provider: "evolution-api",
      status: "missing_evolution_config",
      message: "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente."
    };
  }

  private async parseEvolutionResponse(response: Response, errorStatus: string) {
    const text = await response.text();
    let body: unknown = text;

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text;
    }

    if (!response.ok) {
      return {
        provider: "evolution-api",
        status: errorStatus,
        statusCode: response.status,
        error: body
      };
    }

    return {
      provider: "evolution-api",
      status: "ok",
      data: body
    };
  }

  private maskWhatsappJid(jid?: string) {
    if (!jid) {
      return undefined;
    }

    return jid.replace(/(\d{4})\d+(\d{2}@.*)/, "$1****$2");
  }
}
