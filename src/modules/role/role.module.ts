import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from 'src/database/entities/role.entity';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { PermissionEntity } from 'src/database/entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleEntity, PermissionEntity]),
  ],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
