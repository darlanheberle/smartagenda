import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./modules/app.module";

const defaultAllowedOrigins = [
  "https://www.agendasmart.com.br",
  "https://agendasmart.com.br"
];

function allowedOrigins() {
  const configuredOrigins =
    process.env.APP_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || "";
  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : defaultAllowedOrigins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));
  const corsOrigins = allowedOrigins();

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  });

  const port = Number(process.env.API_PORT || 3333);
  await app.listen(port);
}

bootstrap();
