import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { ProblemsModule } from './problems/problems.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ModerationModule } from './moderation/moderation.module';
import { SignaturesModule } from './signatures/signatures.module';
import { AppealsModule } from './appeals/appeals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PhotosModule } from './photos/photos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CategoriesModule,
    ProblemsModule,
    SubmissionsModule,
    ModerationModule,
    SignaturesModule,
    AppealsModule,
    NotificationsModule,
    AnalyticsModule,
    PhotosModule,
  ],
})
export class AppModule {}
