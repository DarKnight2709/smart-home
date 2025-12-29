import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';

import type { RequestWithUser } from 'src/shared/interfaces/my-cls-store.interface';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo' })
  async findAll(
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const isUnreadOnly = unreadOnly === 'true';

    return await this.notificationService.findAll(isUnreadOnly);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  async getUnreadCount() {
    return {
      count: await this.notificationService.getUnreadCount(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết thông báo' })
  async findOne(@Param('id') id: string) {
    return await this.notificationService.findOne(id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  async markAsRead(@Param('id') id: string) {
    return await this.notificationService.markAsRead(id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  async markAllAsRead() {
    await this.notificationService.markAllAsRead();
    return { message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thông báo' })
  async delete(@Param('id') id: string) {
    await this.notificationService.delete(id);
    return { message: 'Đã xóa thông báo thành công' };
  }
}
