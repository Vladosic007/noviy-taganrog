import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

// ⚠️ Так же, как остальная модерация, до VK-авторизации гарда роли нет.
@Controller('moderation/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }
}
