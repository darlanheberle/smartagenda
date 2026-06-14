import { Module } from "@nestjs/common";
import { AppController } from "../presentation/app.controller";
import { CalendarService } from "../services/calendar.service";
import { EvolutionService } from "../services/evolution.service";
import { AiSchedulingService } from "../services/ai-scheduling.service";
import { ProfessionalRegistryService } from "../services/professional-registry.service";
import { DatabaseService } from "../services/database.service";

@Module({
  controllers: [AppController],
  providers: [
    DatabaseService,
    ProfessionalRegistryService,
    CalendarService,
    EvolutionService,
    AiSchedulingService
  ]
})
export class AppModule {}
