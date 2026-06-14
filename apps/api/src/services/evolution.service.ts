import { Injectable } from "@nestjs/common";

@Injectable()
export class EvolutionService {
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