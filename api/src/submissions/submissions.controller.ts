import { Body, Controller, Get, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubmissionsService } from './submissions.service';

// Файл в multer при memoryStorage.
type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  // POST /submissions — создать заявку (multipart: поля + до 3 фото). Раздел 9.3 ТЗ.
  // Фото храним прямо в Postgres как BYTEA (Render Free tier эфемерный).
  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', 3, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(@UploadedFiles() files: UploadedFile[], @Body() body: Record<string, string>) {
    return this.submissions.create(
      {
        categorySlug: body.categorySlug || undefined,
        customCategory: body.customCategory || undefined,
        description: body.description,
        lat: body.lat != null ? Number(body.lat) : NaN,
        lng: body.lng != null ? Number(body.lng) : NaN,
        addressText: body.addressText || undefined,
        occurredOn: body.occurredOn || undefined,
        isAnonymous: body.isAnonymous === 'true',
        consentVersion: body.consentVersion || undefined,
      },
      files,
    );
  }

  // GET /submissions/my — свои заявки со статусами. Раздел 9.3 ТЗ.
  @Get('my')
  listMine() {
    return this.submissions.listMine();
  }
}
