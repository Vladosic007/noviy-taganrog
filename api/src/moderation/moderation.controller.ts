import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProblemStatus, RejectReason } from '@prisma/client';
import { ModerationService } from './moderation.service';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

// ⚠️ Все ручки модерации ДОЛЖНЫ быть защищены гардом роли (moderator/superadmin) — раздел 3.1 ТЗ.
// До VK-авторизации (фаза 5) гарда нет: любой запрос обрабатывается. Это временно и
// нужно закрыть до публичного запуска.
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  queue() {
    return this.moderation.queue();
  }

  @Get('count')
  async count() {
    return { pending: await this.moderation.count() };
  }

  @Post('submissions/:id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: { title?: string; categorySlug?: string; description?: string; signatureGoal?: number },
  ) {
    return this.moderation.publish(id, body);
  }

  @Post('submissions/:id/reject')
  reject(@Param('id') id: string, @Body() body: { reason: RejectReason; comment?: string }) {
    return this.moderation.reject(id, body);
  }

  @Post('submissions/:id/merge')
  merge(@Param('id') id: string, @Body() body: { problemId: string }) {
    return this.moderation.merge(id, body.problemId);
  }

  @Post('problems/:id/photos')
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  addPhotos(
    @Param('id') id: string,
    @Query('kind') kind: 'before' | 'after' = 'after',
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.moderation.addPhotos(id, kind, files);
  }

  @Post('problems/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: ProblemStatus; comment?: string }) {
    return this.moderation.changeStatus(id, body);
  }
}
