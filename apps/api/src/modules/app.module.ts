import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "../presentation/app.controller";
import { CalendarService } from "../services/calendar.service";
import { EvolutionService } from "../services/evolution.service";
import { AiSchedulingService } from "../services/ai-scheduling.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [CalendarService, EvolutionService, AiSchedulingService]
})
export class AppModule {}
