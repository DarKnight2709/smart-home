import { Inject, Injectable, Logger } from '@nestjs/common';
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
import * as _ from 'lodash';

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
  includeFields?: string[];
  sensitiveFields?: string[];
  trackOldValues?: boolean;
  trackNewValues?: boolean;
}

// Mapping tên entities sang tiếng Việt
export const ENTITY_NAME_MAPPING = Object.freeze({
  UserEntity: 'Người dùng',
  RoleEntity: 'Vai trò',
  PermissionEntity: 'Quyền hạn',
  RefreshTokenEntity: 'Token làm mới',
  AuditLogEntity: 'Nhật ký kiểm toán',
  SettingEntity: 'Ngưỡng cảnh báo',
  SecuritySettingEntity: 'Cài đặt bảo mật',
  NotificationEntity: 'Thông báo',
  Device: 'Thiết bị',
  DeviceCommandEntity: 'Điều khiển thiết bị',
  RoomSensorSnapshotEntity: 'Dữ liệu cảm biến (snapshot)',
} as const);

// Mapping tên fields sang tiếng Việt
export const FIELD_NAME_MAPPING = Object.freeze({
  fullName: 'Họ và tên',
  username: 'Tên đăng nhập',
  password: 'Mật khẩu',
  email: 'Địa chỉ email',
  phone: 'Số điện thoại',
  gender: 'Giới tính',
  dateOfBirth: 'Ngày sinh',
  currentAddress: 'Địa chỉ hiện tại',
  name: 'Tên',
  description: 'Mô tả',
  isActive: 'Hoạt động',
  isSystemRole: 'Vai trò hệ thống',
  permissions: 'Quyền hạn',
  roles: 'Vai trò',
  path: 'Đường dẫn API',
  method: 'Phương thức HTTP',
  module: 'Module',
  token: 'Token',
  userId: 'Người dùng',
  expiresAt: 'Thời gian hết hạn',
  isRevoked: 'Đã bị thu hồi',
  ipAddress: 'Địa chỉ IP',
  userAgent: 'User Agent',

  // SettingEntity
  sensorType: 'Loại sensor',
  minValue: 'Giá trị min',
  maxValue: 'Giá trị max',

  // SecuritySettingEntity
  settingKey: 'Khóa cài đặt',
  settingValue: 'Giá trị cài đặt',
  valueType: 'Loại dữ liệu',

  // NotificationEntity
  type: 'Loại',
  title: 'Tiêu đề',
  message: 'Nội dung',
  severity: 'Mức độ',
  location: 'Vị trí',
  isRead: 'Đã đọc',
  readAt: 'Thời gian đọc',
  emailSent: 'Đã gửi email',
  emailSentAt: 'Thời gian gửi email',

  // Device
  lastState: 'Trạng thái gần nhất',
  status: 'Trạng thái',

  // RoomSensorSnapshotEntity
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm',
  gas: 'Khí gas',
  lightLevel: 'Ánh sáng',
  hasWarning: 'Có cảnh báo',
  temperatureWarningMessage: 'Cảnh báo nhiệt độ',
  gasWarningMessage: 'Cảnh báo gas',
  humidityWarningMessage: 'Cảnh báo độ ẩm',

  action: 'Hành động',
  entityName: 'Tên entity',
  entityId: 'ID entity',
  oldValues: 'Giá trị cũ',
  newValues: 'Giá trị mới',
  changedFields: 'Các trường thay đổi',
  httpMethod: 'Phương thức HTTP',
  endpoint: 'Endpoint',
  requestParams: 'Tham số request',
  requestBody: 'Body request',
  responseStatus: 'Status response',
  responseTime: 'Thời gian xử lý',
  errorMessage: 'Thông báo lỗi',
  errorStack: 'Stack trace lỗi',
  metadata: 'Metadata',
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày cập nhật',
  deletedAt: 'Ngày xóa',
  createdById: 'Người tạo',
  updatedById: 'Người cập nhật',
  deletedById: 'Người xóa',
} as const);

// Mapping giá trị (enum/boolean) sang tiếng Việt để dùng trong description
// Lưu ý: các mapping này KHÔNG ảnh hưởng tới dữ liệu persist (entityName/changedFields vẫn là raw key)
export const VALUE_MAPPING = Object.freeze({
  // NotificationType
  type: {
    security_alert: 'Cảnh báo an ninh',
    sensor_warning: 'Cảnh báo cảm biến',
    device_offline: 'Thiết bị offline',
    system_info: 'Thông tin hệ thống',
  },

  // NotificationSeverity
  severity: {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng',
  },

  // Common room/location codes
  location: {
    'living-room': 'Phòng khách',
    kitchen: 'Nhà bếp',
    bedroom: 'Phòng ngủ',
  },

  // SettingEntity
  sensorType: {
    temperature: 'Nhiệt độ',
    humidity: 'Độ ẩm',
    gas: 'Khí gas',
    light: 'Ánh sáng',
    light_level: 'Ánh sáng',
  },

  // SecuritySettingEntity
  settingKey: {
    max_door_password_attempts: 'Số lần nhập sai mật khẩu tối đa',
    password_attempt_reset_time_minutes: 'Thời gian reset số lần nhập sai (phút)',
    home_name: 'Tên nhà',
    home_address: 'Địa chỉ nhà',
  },
} as const);

const EXCLUDED_ENTITIES = new Set(['AuditLogEntity', 'RefreshTokenEntity']);

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

const EXCLUDE_FIELDS = new Set([
  'updatedAt',
  'updatedById',
  'createdAt',
  'createdById',
  'id',
  'version',
  'deletedAt',
]);

const isEntityExcluded = (entityName: string): boolean =>
  EXCLUDED_ENTITIES.has(entityName);

const normalizeEntityName = (constructor: any): string =>
  constructor.name || 'UnknownEntity';

const extractEntityId = (entity: any): string => {
  if (!entity) return 'unknown';
  const idFields = ['id', 'uuid', '_id', 'entityId'];
  const foundField = _.find(idFields, (field) => !_.isNil(entity[field]));
  return foundField ? String(entity[foundField]) : 'unknown';
};

const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item));

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) sanitized[key] = '***ĐÃ ẨN***';
    else if (value && typeof value === 'object' && !(value instanceof Date))
      sanitized[key] = sanitizeObject(value);
    else sanitized[key] = value;
  }
  return sanitized;
};

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
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal))
      changedFields.push(key);
  }
  return changedFields;
};

const pickKeys = (obj: any, keys: string[]): Record<string, any> => {
  const out: Record<string, any> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const key of keys) {
    if (EXCLUDE_FIELDS.has(key)) continue;
    out[key] = (obj as any)[key];
  }
  return out;
};

const getChangedFieldsByKeys = (
  oldValues: any,
  newValues: any,
  keys: string[],
): string[] => {
  if (!oldValues || !newValues) return [];
  const changed: string[] = [];
  for (const key of keys) {
    if (EXCLUDE_FIELDS.has(key)) continue;
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) changed.push(key);
  }
  return changed;
};

const generateDescription = (
  action: AuditAction,
  entityName: string,
  opts?: {
    entityNameRaw?: string;
    entityRef?: any;
    changedFields?: string[];
    oldValues?: any;
    newValues?: any;
    entityId?: string;
    user?: IRequest['user'];
  },
): string => {

  const formatValue = (field: string | undefined, value: any): string => {
    if (_.isNil(value)) return 'Không có';
    if (value instanceof Date) return value.toISOString();

    const valueType = typeof value;
    if (valueType === 'boolean') {
      if (field === 'isRead') return value ? 'Đã đọc' : 'Chưa đọc';
      if (field === 'emailSent')
        return value ? 'Đã gửi email' : 'Chưa gửi email';
      if (field === 'isActive') return value ? 'Hoạt động' : 'Không hoạt động';
      if (field === 'isSystemRole')
        return value ? 'Vai trò hệ thống' : 'Vai trò thường';
      return value ? 'Có' : 'Không';
    }

    if (valueType === 'string') {
      const trimmed = value.trim();

      // Map enum-ish values to Vietnamese when possible
      if (field && trimmed) {
        const mapper = (VALUE_MAPPING as any)[field] as
          | Record<string, string>
          | undefined;
        const mapped = mapper?.[trimmed];
        if (mapped) return mapped;
      }

      return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
    }
    if (valueType === 'number') return String(value);

    try {
      const json = JSON.stringify(value);
      return json.length > 160 ? `${json.slice(0, 157)}...` : json;
    } catch {
      return String(value);
    }
  };

  const buildUpdateDetail = (): string => {
    const changedFields = opts?.changedFields ?? [];
    if (!changedFields.length) return '';

    const maxFields = 10;
    const shown = changedFields.slice(0, maxFields);
    const oldValues = opts?.oldValues;
    const newValues = opts?.newValues;

    const parts = shown.map((field) => {
      const fieldVi =
        FIELD_NAME_MAPPING[field as keyof typeof FIELD_NAME_MAPPING] || field;
      const oldVal = formatValue(field, oldValues?.[field]);
      const newVal = formatValue(field, newValues?.[field]);
      return `${fieldVi}: ${oldVal} → ${newVal}`;
    });

    const remaining = changedFields.length - shown.length;
    const more = remaining > 0 ? ` (+${remaining} trường)` : '';
    return `; Chi tiết: ${parts.join(', ')}${more}`;
  };

  const buildEntityHint = (): string => {
    const raw = opts?.entityNameRaw;
    if (raw === 'SecuritySettingEntity') {
      const settingKey =
        opts?.newValues?.settingKey ??
        opts?.oldValues?.settingKey ??
        opts?.entityRef?.settingKey;
      if (!settingKey) return '';
      const label =
        FIELD_NAME_MAPPING.settingKey || 'settingKey';
      return `; ${label}: ${formatValue('settingKey', settingKey)}`;
    }

    if (raw === 'SettingEntity') {
      const sensorType =
        opts?.newValues?.sensorType ??
        opts?.oldValues?.sensorType ??
        opts?.entityRef?.sensorType;
      if (!sensorType) return '';
      const label =
        FIELD_NAME_MAPPING.sensorType || 'sensorType';
      return `; ${label}: ${formatValue('sensorType', sensorType)}`;
    }

    return '';
  };

  const entityHint = buildEntityHint();

  const buildCreateSummary = (): string => {
    const newValues = opts?.newValues;
    if (!newValues || typeof newValues !== 'object') return '';

    const entries = Object.entries(newValues)
      .filter(([key, value]) => {
        if (EXCLUDE_FIELDS.has(key)) return false;
        if (SENSITIVE_FIELDS.has(key)) return false;
        // only include primitives to avoid huge/nested payloads
        return (
          _.isNil(value) ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value instanceof Date
        );
      })
      .slice(0, 8)
      .map(([key, value]) => {
        const keyVi =
          FIELD_NAME_MAPPING[key as keyof typeof FIELD_NAME_MAPPING] || key;
        return `${keyVi}: ${formatValue(key, value)}`;
      });

    if (!entries.length) return '';
    return `; Dữ liệu: ${entries.join(', ')}`;
  };
  const actionMap: Record<AuditAction, string> = {
    [AuditAction.CREATE]: `Thêm mới ${entityName}${entityHint}${buildCreateSummary()}`,
    [AuditAction.UPDATE]: `Cập nhật ${entityName}${opts?.changedFields?.length ? ` (${opts.changedFields.length} trường)` : ''}${entityHint}${buildUpdateDetail()}`,
    [AuditAction.DELETE]: `Xóa ${entityName}${entityHint}${opts?.entityId ? ` (ID: ${opts.entityId})` : ''}`,
    [AuditAction.SOFT_DELETE]: `Xóa mềm ${entityName}${entityHint}${opts?.entityId ? ` (ID: ${opts.entityId})` : ''}`,
    [AuditAction.RESTORE]: `Khôi phục ${entityName}${entityHint}${opts?.entityId ? ` (ID: ${opts.entityId})` : ''}`,
    [AuditAction.PERMISSION_CHANGE]: `Cập nhật quyền hạn`,
    [AuditAction.CUSTOM]: `Thao tác tùy chỉnh trên ${entityName}${entityHint}`,
  };
  return (
    actionMap[action] || `Thực hiện ${action} trên ${entityName}`
  );
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
    this.dataSource.subscribers.push(this);
    this.logger.log('✅ AuditLogSubscriber đã được khởi tạo');
  }

  listenTo() {
    return AuditableEntity;
  }

  async afterInsert(event: InsertEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.CREATE,
      entity: event.entity,
      entityName: event.metadata?.name,
      newValues: event.entity,
    });
  }

  async afterUpdate(event: UpdateEvent<AuditableEntity>) {
    if (!event.entity) return;

    // TypeORM update events can be tricky:
    // - event.entity can be partial
    // - databaseEntity may not contain relations
    // If we diff raw objects, we can get false positives (old missing field, new has field).
    // Use updatedColumns (real DB columns) and diff against a merged "new" snapshot.
    const dbEntity = (event.databaseEntity ?? {}) as any;
    const mergedNew = { ...dbEntity, ...(event.entity as any) };

    const updatedColumns = (event.updatedColumns ?? [])
      .map((c: any) => c.propertyName as string)
      .filter(Boolean);

    const columnKeys = (event.metadata?.columns ?? [])
      .map((c: any) => c.propertyName as string)
      .filter(Boolean);

    const candidateKeys = updatedColumns.length ? updatedColumns : columnKeys;
    const changedFields = getChangedFieldsByKeys(dbEntity, mergedNew, candidateKeys);
    if (!changedFields.length) return;

    const oldValues = pickKeys(dbEntity, changedFields);
    const newValues = pickKeys(mergedNew, changedFields);
    await this.handleAuditEvent({
      action: AuditAction.UPDATE,
      entity: event.entity,
      entityName: event.metadata?.name,
      entityRef: mergedNew,
      oldValues,
      newValues,
      changedFields,
    });
  }

  async afterRemove(event: RemoveEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.DELETE,
      entity: event.entity,
      entityName: event.metadata?.name,
      oldValues: event.entity,
    });
  }

  async afterSoftRemove(event: SoftRemoveEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.SOFT_DELETE,
      entity: event.entity,
      entityName: event.metadata?.name,
      oldValues: event.entity,
      changedFields: ['deletedAt'],
    });
  }

  async afterRecover(event: RecoverEvent<AuditableEntity>) {
    await this.handleAuditEvent({
      action: AuditAction.RESTORE,
      entity: event.entity,
      entityName: event.metadata?.name,
      newValues: event.entity,
      changedFields: ['deletedAt'],
    });
  }

  private async handleAuditEvent(params: {
    action: AuditAction;
    entity: any;
    entityName?: string;
    entityRef?: any;
    oldValues?: any;
    newValues?: any;
    changedFields?: string[];
  }): Promise<void> {
    try {
      if (this.auditConfig.enabled === false) return;
      if (!params.entity) return;

      // TypeORM can provide a plain object for event.entity (e.g. repository.update/query builder),
      // whose constructor.name is just "Object". Prefer metadata entity name when available.
      const entityName =
        params.entityName && params.entityName !== 'Object'
          ? params.entityName
          : normalizeEntityName(params.entity.constructor);
      if (isEntityExcluded(entityName)) return;

      // NOTE:
      // - Persist only raw (English) identifiers to DB for consistency and future filtering.
      // - Use Vietnamese mapping ONLY for description.
      const entityNameVi =
        ENTITY_NAME_MAPPING[entityName as keyof typeof ENTITY_NAME_MAPPING] ||
        entityName;
      const changedFieldsVi = (params.changedFields || []).map(
        (field) =>
          FIELD_NAME_MAPPING[field as keyof typeof FIELD_NAME_MAPPING] || field,
      );

      const entityId = extractEntityId(params.entity);
      const context = this.getAuditContext();
      const config = this.getAuditConfig();

      // CLS context may be missing for async callbacks (e.g., MQTT client publish).
      // Fall back to entity audit fields so we still attribute the performer.
      const fallbackUserId: string | undefined =
        context.user?.id ||
        params.entity?.updatedById ||
        params.entity?.createdById;

      // Nếu không xác định được người thực hiện -> coi là hệ thống/background và không log.
      if (!fallbackUserId) return;

      const sanitizedOldValues = config.trackOldValues
        ? sanitizeObject(params.oldValues)
        : undefined;
      const sanitizedNewValues = config.trackNewValues
        ? sanitizeObject(params.newValues)
        : undefined;

      const auditLog = this.auditRepository.create({
        action: params.action,
        entityName,
        entityId,
        userId: fallbackUserId,
        createdById: fallbackUserId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        httpMethod: context.httpMethod as HttpMethod,
        endpoint: context.endpoint,
        status: AuditStatus.SUCCESS,
        oldValues: sanitizedOldValues,
        newValues: sanitizedNewValues,
        changedFields: params.changedFields || [],
        metadata: {
          ...context.metadata,
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        },
        description: generateDescription(params.action, entityNameVi, {
          entityNameRaw: entityName,
          entityRef: params.entityRef ?? params.entity,
          changedFields: params.changedFields || [],
          oldValues: sanitizedOldValues,
          newValues: sanitizedNewValues,
          entityId,
          user: context.user,
        }),
      });

      setImmediate(async () => {
        try {
          await this.auditRepository.save(auditLog);
        } catch (error) {
          this.logger.error(
            `❌ Lỗi lưu audit log: ${entityName} - ${entityId}`,
            error,
          );
        }
      });
    } catch (error) {
      this.logger.error(`❌ Lỗi xử lý audit event ${params.action}:`, error);
    }
  }

  private getAuditContext(): AuditContext {
    try {
      return this.clsService.get('auditContext') || {};
    } catch {
      return {};
    }
  }

  private getAuditConfig(): Required<
    Pick<AuditConfig, 'enabled' | 'trackOldValues' | 'trackNewValues'>
  > {
    return {
      enabled: this.auditConfig.enabled ?? true,
      trackOldValues: this.auditConfig.trackOldValues ?? true,
      trackNewValues: this.auditConfig.trackNewValues ?? true,
    };
  }
}
