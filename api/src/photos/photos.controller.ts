import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// GET /photos/:id/file — отдаёт бинарник фото прямо из БД.
// Используется вместо статики /uploads/, потому что на Render Free tier диск эфемерный
// (файлы пропадают при рестарте). Бинарник живёт в поле Photo.data (BYTEA).
@Controller('photos')
export class PhotosController {
  constructor(private prisma: PrismaService) {}

  @Get(':id/file')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
      select: { data: true, mimeType: true },
    });
    if (!photo || !photo.data) throw new NotFoundException();
    res.setHeader('Content-Type', photo.mimeType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(photo.data);
  }
}
