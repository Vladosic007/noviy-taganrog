import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  // CORS: в dev — всё, в проде — только домены фронта из CORS_ORIGINS (через запятую).
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Раздача загруженных фото (этап 1 — локальная FS, раздел 11.2 ТЗ).
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  // Раздача сформированных PDF-обращений (раздел 6.3 ТЗ).
  app.useStaticAssets(join(process.cwd(), 'appeals'), { prefix: '/appeals/' });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`API готов: http://localhost:${port}/api/v1`);
}

bootstrap();
