import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppealsService } from './appeals.service';

// ⚠️ Так же, как остальная модерация, до VK-авторизации гарда роли нет. Закрыть до
// публичного запуска — раздел 3.1 ТЗ.
@Controller('moderation')
export class AppealsController {
  constructor(private readonly appeals: AppealsService) {}

  @Get('streets')
  streets() {
    return this.appeals.streetsSummary();
  }

  @Get('streets/:key/problems')
  streetProblems(@Param('key') key: string) {
    return this.appeals.streetProblems(decodeURIComponent(key));
  }

  @Post('appeals')
  create(@Body() body: { streetKey: string; problemIds: string[] }) {
    return this.appeals.createAppeal(body.streetKey, body.problemIds);
  }
}
