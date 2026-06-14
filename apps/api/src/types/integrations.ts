export type EvolutionWebhookPayload = {
  instance?: string;
  instanceName?: string;
  phone?: string;
  event?: string;
  data?: {
    instance?: string;
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
    };
    pushName?: string;
  };
};

export type IncomingWhatsAppMessage = {
  instanceName: string;
  customerPhone: string;
  customerName?: string;
  text: string;
};