import { Exclude } from 'class-transformer';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { HttpMethod } from 'src/shared/enums/http-method.enum';
import { AuditableEntity } from '../base/base.entity';
import { UserEntity } from './user.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SOFT_DELETE = 'SOFT_DELETE',
  RESTORE = 'RESTORE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  UPLOAD = 'UPLOAD',
  CUSTOM = 'CUSTOM',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
}

export interface AuditMetadata {
  browser?: string;
  os?: string;
  device?: string;
  sessionId?: string;
  correlationId?: string;
  requestId?: string;
  userAgent?: string;
  referer?: string;
  geolocation?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  [key: string]: any;
}

export interface AuditValues {
  [key: string]: any;
}

@Entity('audit_logs')
export class AuditLogEntity extends AuditableEntity {
  @Column({
    type: 'enum',
    enum: AuditAction,
    comment: 'Loại hành động được thực hiện',
  })
  action: AuditAction;

  @Column({
    type: 'varchar',
    name: 'entity_name',
    length: 100,
    comment: 'Tên entity/table bị tác động',
  })
  entityName: string;

  @Column({
    type: 'varchar',
    name: 'entity_id',
    length: 50,
    nullable: true,
    comment: 'ID của record bị tác động',
  })
  entityId: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'user_id',
    comment: 'ID của user thực hiện hành động',
  })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({
    type: 'inet',
    nullable: true,
    name: 'ip_address',
    comment: 'Địa chỉ IP của người thực hiện',
  })
  ipAddress: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'user_agent',
    comment: 'User Agent string',
  })
  userAgent: string;

  @Exclude()
  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'old_values',
    comment: 'Giá trị cũ trước khi thay đổi',
  })
  oldValues: AuditValues;

  @Exclude()
  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'new_values',
    comment: 'Giá trị mới sau khi thay đổi',
  })
  newValues: AuditValues;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'changed_fields',
    comment: 'Các trường bị thay đổi',
  })
  changedFields: string[];

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
  })
  httpMethod: HttpMethod;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'URL endpoint được gọi',
  })
  endpoint: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'request_params',
    comment: 'Request parameters',
  })
  requestParams: any;

  @Column({
    type: 'jsonb',
    nullable: true,
    name: 'request_body',
    comment: 'Request body (đã được sanitize)',
  })
  requestBody: any;

  @Column({
    type: 'integer',
    nullable: true,
    name: 'response_status',
    comment: 'HTTP status code',
  })
  responseStatus: number;

  @Column({
    type: 'integer',
    nullable: true,
    name: 'response_time',
    comment: 'Thời gian xử lý request (ms)',
  })
  responseTime: number;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
    comment: 'Trạng thái của hành động',
  })
  status: AuditStatus;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Mô tả chi tiết về hành động',
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_message',
    comment: 'Thông báo lỗi nếu có',
  })
  errorMessage: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_stack',
    comment: 'Stack trace của lỗi',
  })
  errorStack: string;

  // Metadata và thông tin bổ sung
  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Metadata bổ sung (browser, device, location, etc.)',
  })
  metadata: AuditMetadata;
}
