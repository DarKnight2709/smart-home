import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { PermissionEntity } from 'src/database/entities/permission.entity';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionEntity]), 
  ],
  providers: [PermissionService],
  controllers: [PermissionController],
  exports: [PermissionService]
})
export class PermissionModule {

}
