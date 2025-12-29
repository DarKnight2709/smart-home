import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from 'src/database/entities/notification.entity';
import {
  NotificationSeverity,
  NotificationType,
} from 'src/shared/enums/notification.enum';
import { UserEntity } from 'src/database/entities/user.entity';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  location?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  userId?: string; // null = broadcast to all users
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    const notification = this.notificationRepo.create({
      ...dto,
      severity: dto.severity || NotificationSeverity.LOW,
      isRead: false,
      emailSent: false,
    });

    return await this.notificationRepo.save(notification);
  }

  async createForUsers(
    dto: Omit<CreateNotificationDto, 'userId'>,
    userIds: string[],
  ): Promise<NotificationEntity[]> {
    const notifications = userIds.map((userId) =>
      this.notificationRepo.create({
        ...dto,
        severity: dto.severity || NotificationSeverity.LOW,
        isRead: false,
        emailSent: false,
      }),
    );

    return await this.notificationRepo.save(notifications);
  }

  async findAll(
    unreadOnly = false,
  ): Promise<NotificationEntity[]> {
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .orderBy('notification.createdAt', 'DESC');
    if (unreadOnly) {
      query.andWhere('notification.isRead = :isRead', { isRead: false });
    }

    return await query.getMany();
  }

  async findOne(id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return notification;
  }

  async markAsRead(id: string): Promise<NotificationEntity> {
    const notification = await this.findOne(id);

    notification.isRead = true;
    notification.readAt = new Date();

    return await this.notificationRepo.save(notification);
  }

  async markAllAsRead(): Promise<void> {
    const query = this.notificationRepo
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ isRead: true, readAt: new Date() })
      .where('isRead = :isRead', { isRead: false });


    await query.execute();
  }

  async markEmailSent(id: string): Promise<void> {
    await this.notificationRepo.update(id, {
      emailSent: true,
      emailSentAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    const notification = await this.findOne(id);
    await this.notificationRepo.remove(notification);
  }

  async getUnreadCount(userId?: string): Promise<number> {
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.isRead = :isRead', { isRead: false });

    return await query.getCount();
  }

  // Helper method để lấy users có permission xem notifications
  async getUsersWithNotificationPermission(
    permissionMethod: string,
    permissionPath: string,
  ): Promise<UserEntity[]> {
    return await this.userRepo
      .createQueryBuilder('users')
      .leftJoinAndSelect('users.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .where('permissions.path = :permissionPath', { permissionPath })
      .andWhere('permissions.method = :permissionMethod', { permissionMethod })
      .andWhere('users.email IS NOT NULL')
      .andWhere('users.email != :emptyEmail', { emptyEmail: '' })
      .getMany();
  }
}
