import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity } from 'src/database/entities/audit-log.entity';
import { AuditLogSubscriber, AuditConfig } from './subscribers/audit-log.subscriber';
import { AuditableSubscriber } from './subscribers/auditable.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    AuditLogSubscriber,  // NestJS sẽ tự động khởi tạo subscriber
    AuditableSubscriber, // NestJS sẽ tự động khởi tạo subscriber
    // Cấu hình audit log (có thể tùy chỉnh)
    {
      provide: 'AUDIT_CONFIG',
      useValue: {
        enabled: true,
        trackOldValues: true,
        trackNewValues: true,
        excludeFields: [],
        sensitiveFields: [],
      } as AuditConfig,
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
