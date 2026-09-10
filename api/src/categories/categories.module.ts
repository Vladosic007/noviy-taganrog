import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { SeedService } from './seed.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, SeedService],
})
export class CategoriesModule {}
