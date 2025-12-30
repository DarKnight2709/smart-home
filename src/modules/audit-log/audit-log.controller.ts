import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetAuditLogsQueryDto } from './audit-log.dto';

@ApiTags('Audit Logs')
@Controller('audit-log')
export class AuditLogController {

  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách lịch sử hoạt động (audit logs)' })
  async getAuditLogs(@Query() query: GetAuditLogsQueryDto) {
    return await this.auditLogService.findAll(query);
  }

}
