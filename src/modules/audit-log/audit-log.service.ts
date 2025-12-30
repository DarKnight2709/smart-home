import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import {
  AuditAction,
  AuditLogEntity,
  AuditStatus,
} from 'src/database/entities/audit-log.entity';
import { MyClsStore } from 'src/shared/interfaces/my-cls-store.interface';
import { Repository } from 'typeorm';
import { GetAuditLogsQueryDto } from './audit-log.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  private static readonly SYSTEM_USER = {
    id: 'system',
    username: 'system',
    fullName: 'Hệ thống',
  };

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
    private readonly clsService: ClsService<MyClsStore>,
  ) {}

  async findAll(query: GetAuditLogsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      action,
      status,
      userId,
      entityName,
      from,
      to,
    } = query;

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) qb.andWhere('audit.action = :action', { action });
    if (status) qb.andWhere('audit.status = :status', { status });
    if (userId) qb.andWhere('audit.userId = :userId', { userId });

    if (entityName) {
      qb.andWhere('audit.entityName ILIKE :entityName', {
        entityName: `%${entityName}%`,
      });
    }

    if (from) {
      qb.andWhere('audit.createdAt >= :from', { from: new Date(from) });
    }
    if (to) {
      qb.andWhere('audit.createdAt <= :to', { to: new Date(to) });
    }

    if (search?.trim()) {
      qb.andWhere(
        '(audit.description ILIKE :search OR audit.endpoint ILIKE :search OR audit.entityName ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    // Normalize performer: if no user performed the action, return as "Hệ thống".
    for (const audit of data) {
      if (!audit.user) {
        (audit as any).user = AuditLogService.SYSTEM_USER;
      }
    }

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  /**
   * Log a custom audit event (e.g. login/logout) without relying on TypeORM entity subscribers.
   */
  async logCustom(params: {
    action: AuditAction;
    status?: AuditStatus;
    description?: string;
    entityName?: string;
    entityId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    httpMethod?: string;
    requestParams?: any;
    requestBody?: any;
    responseStatus?: number;
    responseTime?: number;
    metadata?: any;
    error?: unknown;
  }): Promise<void> {
    try {
      const ctx = this.clsService.get('auditContext');

      const errorMessage =
        params.error instanceof Error ? params.error.message : undefined;
      const errorStack =
        params.error instanceof Error ? params.error.stack : undefined;

      const audit = this.auditRepository.create({
        action: params.action,
        status: params.status ?? AuditStatus.SUCCESS,
        entityName: params.entityName ?? 'SYSTEM',
        entityId: params.entityId,
        userId: params.userId ?? ctx?.user?.id,
        createdById: params.userId ?? ctx?.user?.id,
        ipAddress: params.ipAddress ?? ctx?.ipAddress,
        userAgent: params.userAgent ?? ctx?.userAgent,
        endpoint: params.endpoint ?? ctx?.endpoint,
        httpMethod: (params.httpMethod ?? ctx?.httpMethod) as any,
        requestParams: params.requestParams,
        requestBody: params.requestBody,
        responseStatus: params.responseStatus,
        responseTime: params.responseTime,
        description: params.description,
        metadata: {
          ...(ctx?.metadata ?? {}),
          ...(params.metadata ?? {}),
          requestId: ctx?.requestId,
          timestamp: new Date().toISOString(),
        },
        errorMessage,
        errorStack,
      });

      await this.auditRepository.save(audit);
    } catch (error) {
      this.logger.error('❌ Failed to write custom audit log', error);
    }
  }
}
