import { Injectable } from "@nestjs/common";

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

    return {
      provider: "evolution-api",
      status: "connected",
      instances: await response.json()
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
      response: await response.json(),
      ...input
    };
  }
}