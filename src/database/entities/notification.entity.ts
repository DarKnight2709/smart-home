import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AuditableEntity } from '../base/base.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationSeverity,
  NotificationType,
} from 'src/shared/enums/notification.enum';

@Entity('notifications')
export class NotificationEntity extends AuditableEntity {
  @ApiProperty({
    description: 'Loại thông báo',
    enum: NotificationType,
    example: NotificationType.SECURITY_ALERT,
  })
  @Column({
    name: 'type',
    type: 'enum',
    enum: NotificationType,
    comment: 'Loại thông báo',
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Tiêu đề thông báo',
    example: 'Cảnh báo nhập sai mật khẩu',
  })
  @Column({
    name: 'title',
    type: 'varchar',
    length: 255,
    comment: 'Tiêu đề thông báo',
  })
  title: string;

  @ApiProperty({
    description: 'Nội dung thông báo',
    example: 'Đã nhập sai mật khẩu cửa phòng khách 5 lần liên tiếp',
  })
  @Column({
    name: 'message',
    type: 'text',
    comment: 'Nội dung thông báo',
  })
  message: string;

  @ApiProperty({
    description: 'Mức độ nghiêm trọng',
    enum: NotificationSeverity,
    example: NotificationSeverity.HIGH,
  })
  @Column({
    name: 'severity',
    type: 'enum',
    enum: NotificationSeverity,
    default: NotificationSeverity.LOW,
    comment: 'Mức độ nghiêm trọng',
  })
  severity: NotificationSeverity;

  @ApiProperty({
    description: 'Vị trí xảy ra sự kiện (phòng)',
    example: 'living-room',
    required: false,
  })
  @Column({
    name: 'location',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Vị trí xảy ra sự kiện',
  })
  location?: string;

  @ApiProperty({
    description: 'Dữ liệu bổ sung dạng JSON',
    example: { failedAttempts: 5, lastAttemptTime: '2025-12-28T10:30:00Z' },
    required: false,
  })
  @Column({
    name: 'metadata',
    type: 'json',
    nullable: true,
    comment: 'Dữ liệu bổ sung dạng JSON',
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Trạng thái đã đọc',
    example: false,
  })
  @Column({
    name: 'is_read',
    type: 'boolean',
    default: false,
    comment: 'Trạng thái đã đọc',
  })
  isRead: boolean;

  @ApiProperty({
    description: 'Thời gian đọc',
    example: '2025-12-28T10:35:00Z',
    required: false,
  })
  @Column({
    name: 'read_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Thời gian đọc',
  })
  readAt?: Date;



  @ApiProperty({
    description: 'Đã gửi email',
    example: false,
  })
  @Column({
    name: 'email_sent',
    type: 'boolean',
    default: false,
    comment: 'Đã gửi email',
  })
  emailSent: boolean;

  @ApiProperty({
    description: 'Thời gian gửi email',
    required: false,
  })
  @Column({
    name: 'email_sent_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Thời gian gửi email',
  })
  emailSentAt?: Date;
}
