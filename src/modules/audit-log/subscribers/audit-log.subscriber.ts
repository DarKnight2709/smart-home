import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { AuditableEntity } from 'src/database/base/base.entity';
import {
  AuditAction,
  AuditLogEntity,
  AuditStatus,
} from 'src/database/entities/audit-log.entity';
import { HttpMethod } from 'src/shared/enums/http-method.enum';
import { MyClsStore } from 'src/shared/interfaces/my-cls-store.interface';
import { IRequest } from 'src/shared/types';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RecoverEvent,
  RemoveEvent,
  Repository,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';

export interface AuditContext {
  user?: IRequest['user'];
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  httpMethod?: string;
  endpoint?: string;
  metadata?: any;
}

export interface AuditConfig {
  enabled?: boolean;
  excludeFields?: string[];
  sensitiveFields?: string[];
  trackOldValues?: boolean;
  trackNewValues?: boolean;
}

// Các entities không cần audit log
const EXCLUDED_ENTITIES = new Set([
  'AuditLogEntity',
  'RefreshTokenEntity',
]);

// Các fields nhạy cảm cần ẩn
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'salt',
  'refreshToken',
  'accessToken',
  'token',
  'secret',
  'privateKey',
  'apiKey',
]);

// Các fields bỏ qua khi so sánh thay đổi
const EXCLUDE_FIELDS = new Set([
  'updatedAt',
  'updatedById',
  'createdAt',
  'createdById',
  'id',
  'version',
  'deletedAt',
]);

/**
 * Kiểm tra entity có bị loại trừ khỏi audit log không
 */
const isEntityExcluded = (entityName: string): boolean =>
  EXCLUDED_ENTITIES.has(entityName);

/**
 * Chuẩn hóa tên entity từ class name
 */
const normalizeEntityName = (constructor: any): string =>
  constructor.name || 'UnknownEntity';

/**
 * Lấy ID từ entity
 */
const extractEntityId = (entity: any): string => {
  if (!entity) return 'unknown';
  return entity.id ? String(entity.id) : 'unknown';
};

/**
 * Sanitize object, ẩn các fields nhạy cảm
 */
const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '***ĐÃ ẨN***';
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Lấy danh sách các fields đã thay đổi
 */
const getChangedFields = (oldValues: any, newValues: any): string[] => {
  if (!oldValues || !newValues) return [];

  const changedFields: string[] = [];
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  for (const key of allKeys) {
    if (EXCLUDE_FIELDS.has(key)) continue;

    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];

    // So sánh giá trị
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedFields.push(key);
    }
  }

  return changedFields;
};

/**
 * Tạo mô tả cho audit log
 */
const generateDescription = (
  action: AuditAction,
  entityName: string,
  changedFields?: string[],
  user?: IRequest['user'],
): string => {
  const userInfo = user ? ` bởi ${user.fullName || user.username}` : '';
  
  const actionMap: Record<AuditAction, string> = {
    [AuditAction.CREATE]: `Thêm mới ${entityName}${userInfo}`,
    [AuditAction.UPDATE]: `Cập nhật ${entityName}${userInfo}${changedFields?.length ? ` (${changedFields.length} trường)` : ''}`,
    [AuditAction.DELETE]: `Xóa ${entityName}${userInfo}`,
    [AuditAction.SOFT_DELETE]: `Xóa mềm ${entityName}${userInfo}`,
    [AuditAction.RESTORE]: `Khôi phục ${entityName}${userInfo}`,
    [AuditAction.LOGIN]: `Đăng nhập hệ thống${userInfo}`,
    [AuditAction.LOGOUT]: `Đăng xuất hệ thống${userInfo}`,
    [AuditAction.FAILED_LOGIN]: `Đăng nhập thất bại${userInfo}`,
    [AuditAction.PASSWORD_CHANGE]: `Thay đổi mật khẩu${userInfo}`,
    [AuditAction.PERMISSION_CHANGE]: `Cập nhật quyền hạn${userInfo}`,
    [AuditAction.EXPORT]: `Xuất dữ liệu ${entityName}${userInfo}`,
    [AuditAction.IMPORT]: `Nhập dữ liệu ${entityName}${userInfo}`,
    [AuditAction.VIEW]: `Xem thông tin ${entityName}${userInfo}`,
    [AuditAction.DOWNLOAD]: `Tải xuống ${entityName}${userInfo}`,
    [AuditAction.UPLOAD]: `Tải lên ${entityName}${userInfo}`,
    [AuditAction.CUSTOM]: `Thao tác tùy chỉnh trên ${entityName}${userInfo}`,
  };

  return actionMap[action] || `Thực hiện ${action} trên ${entityName}${userInfo}`;
};

@Injectable()
@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(AuditLogSubscriber.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
    private readonly clsService: ClsService<MyClsStore>,
    private readonly dataSource: DataSource,
    @Inject('AUDIT_CONFIG')
    private readonly auditConfig: AuditConfig = {},
  ) {
    // Đăng ký subscriber vào TypeORM
    this.dataSource.subscribers.push(this);
    this.logger.log('✅ AuditLogSubscriber đã được khởi tạo');
  }

  listenTo() {
    return AuditableEntity;
  }

  /**
   * Xử lý sau khi INSERT
   */
  async afterInsert(event: InsertEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.CREATE,
      entity: event.entity,
      newValues: event.entity,
    });
  }

  /**
   * Xử lý sau khi UPDATE
   */
  async afterUpdate(event: UpdateEvent<AuditableEntity>) {
    if (!event.entity) return;

    const changedFields = getChangedFields(
      event.databaseEntity,
      event.entity,
    );

    // Bỏ qua nếu không có thay đổi
    if (changedFields.length === 0) return;

    await this.handleAuditEvent({
      action: AuditAction.UPDATE,
      entity: event.entity,
      oldValues: event.databaseEntity,
      newValues: event.entity,
      changedFields,
    });
  }

  /**
   * Xử lý sau khi REMOVE (hard delete)
   */
  async afterRemove(event: RemoveEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.DELETE,
      entity: event.entity,
      oldValues: event.entity,
    });
  }

  /**
   * Xử lý sau khi SOFT_REMOVE
   */
  async afterSoftRemove(event: SoftRemoveEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.SOFT_DELETE,
      entity: event.entity,
      oldValues: event.entity,
      changedFields: ['deletedAt'],
    });
  }

  /**
   * Xử lý sau khi RECOVER
   */
  async afterRecover(event: RecoverEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.RESTORE,
      entity: event.entity,
      newValues: event.entity,
      changedFields: ['deletedAt'],
    });
  }

  /**
   * Xử lý audit event chung
   */
  private async handleAuditEvent(params: {
    action: AuditAction;
    entity: any;
    oldValues?: any;
    newValues?: any;
    changedFields?: string[];
  }): Promise<void> {
    try {
      // Kiểm tra xem audit có được bật không
      if (this.auditConfig.enabled === false) return;

      if (!params.entity) return;

      const entityName = normalizeEntityName(params.entity.constructor);
      
      // Bỏ qua các entities bị loại trừ
      if (isEntityExcluded(entityName)) return;

      const entityId = extractEntityId(params.entity);
      const context = this.getAuditContext();
      const config = this.getAuditConfig();

      // Tạo audit log entity
      const auditLog = this.auditRepository.create({
        action: params.action,
        entityName,
        entityId,
        userId: context.user?.id,
        createdById: context.user?.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        httpMethod: context.httpMethod as HttpMethod,
        endpoint: context.endpoint,
        status: AuditStatus.SUCCESS,
        oldValues: config.trackOldValues
          ? sanitizeObject(params.oldValues)
          : undefined,
        newValues: config.trackNewValues
          ? sanitizeObject(params.newValues)
          : undefined,
        changedFields: params.changedFields || [],
        metadata: {
          ...context.metadata,
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        },
        description: generateDescription(
          params.action,
          entityName,
          params.changedFields,
          context.user,
        ),
      });

      // Lưu audit log (async, không chặn transaction chính)
      setImmediate(async () => {
        try {
          await this.auditRepository.save(auditLog);
        } catch (error) {
          this.logger.error(`❌ Lỗi lưu audit log: ${entityName} - ${entityId}`, error);
        }
      });
    } catch (error) {
      this.logger.error(
        `❌ Lỗi xử lý audit event ${params.action}:`,
        error,
      );
    }
  }

  /**
   * Lấy audit context từ CLS
   */
  private getAuditContext(): AuditContext {
    try {
      return this.clsService.get('auditContext') || {};
    } catch {
      return {};
    }
  }

  /**
   * Lấy config với giá trị mặc định
   */
  private getAuditConfig(): Required<Pick<AuditConfig, 'enabled' | 'trackOldValues' | 'trackNewValues'>> {
    return {
      enabled: this.auditConfig.enabled ?? true,
      trackOldValues: this.auditConfig.trackOldValues ?? true,
      trackNewValues: this.auditConfig.trackNewValues ?? true,
    };
  }
}
