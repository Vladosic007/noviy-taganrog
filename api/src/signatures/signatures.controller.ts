import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SignaturesService } from './signatures.service';

// Действия «Подписать обращение» и «Следить» (раздел 9.3 ТЗ).
// Смонтированы на /problems/:id/... , чтобы соответствовать API из ТЗ.
@Controller('problems/:id')
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) {}

  @Get('signature')
  state(@Param('id') id: string) {
    return this.signatures.state(id);
  }

  @Post('signature')
  sign(
    @Param('id') id: string,
    @Body() body: { fullName: string; consentTextVersion?: string },
    @Req() req: Request,
  ) {
    return this.signatures.sign(id, {
      fullName: body.fullName,
      consentTextVersion: body.consentTextVersion,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('signature')
  revoke(@Param('id') id: string) {
    return this.signatures.revoke(id);
  }

  @Post('subscribe')
  subscribe(@Param('id') id: string) {
    return this.signatures.toggleSubscription(id);
  }
}
