import { Controller, Get, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('mine')
  mine() {
    return this.notifications.listMine();
  }

  @Get('count')
  async count() {
    return { unread: await this.notifications.unreadCount() };
  }

  @Post('read-all')
  async readAll() {
    await this.notifications.markAllRead();
    return { ok: true };
  }
}
