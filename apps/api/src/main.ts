import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_APP_URL || true
  });

  const port = Number(process.env.API_PORT || 3333);
  await app.listen(port);
}

bootstrap();
