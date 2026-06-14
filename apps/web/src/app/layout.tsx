import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartAgenda",
  description: "SaaS para atendimento por WhatsApp, Google Agenda e IA."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
