import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuditAction, AuditStatus } from 'src/database/entities/audit-log.entity';

export class GetAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Trang', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số bản ghi mỗi trang', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo mô tả/endpoint/entity', example: 'login' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditStatus })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({ description: 'Filter theo userId (uuid)', example: 'c1d2...' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter theo entityName', example: 'UserEntity' })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (ISO)', example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (ISO)', example: '2025-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  to?: string;
}
