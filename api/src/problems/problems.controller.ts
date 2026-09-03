import { Controller, Get, Param, ParseFloatPipe, Post, Query } from '@nestjs/common';
import { ProblemStatus } from '@prisma/client';
import { ProblemsService } from './problems.service';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  // ВАЖНО: статические маршруты объявляем ДО ':id', иначе '/geojson' и '/nearby' попадут в :id.
  @Get('geojson')
  geojson() {
    return this.problems.geojson();
  }

  // GET /problems/nearby?lat=&lng=&radius=&category=
  @Get('nearby')
  nearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    return this.problems.nearby(lat, lng, radius ? Number(radius) : 100, category);
  }

  @Get()
  findAll(@Query('status') status?: ProblemStatus, @Query('category') category?: string) {
    return this.problems.findAll({ status, category });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.problems.findOne(id);
  }

  @Post(':id/like')
  like(@Param('id') id: string) {
    return this.problems.toggleLike(id);
  }
}
