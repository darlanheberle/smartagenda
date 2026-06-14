import { Injectable } from "@nestjs/common";

@Injectable()
export class EvolutionService {
  async sendTextMessage(input: { phone: string; message: string }) {
    return {
      provider: "evolution-api",
      status: "mocked",
      ...input
    };
  }
}
