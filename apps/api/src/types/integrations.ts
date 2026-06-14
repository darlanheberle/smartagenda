export type EvolutionWebhookPayload = {
  phone?: string;
  event?: string;
  data?: {
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
