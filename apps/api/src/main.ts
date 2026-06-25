import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_APP_URL || true,
    credentials: true
  });

  const port = Number(process.env.API_PORT || 3333);
  await app.listen(port);
}

bootstrap();
