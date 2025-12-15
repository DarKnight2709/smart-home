import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionEntity } from 'src/database/entities/permission.entity';
import { HttpMethod } from 'src/shared/enums/http-method.enum';
import { IRouteInfo } from 'src/shared/types';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  async findAll() {
    try {
      const permissions = this.permissionRepository.find({
        select: {
          id: true,
          name: true,
          description: true,
          path: true,
          method: true,
          module: true,
        }
      })
      return permissions;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException("Lỗi server")
    }
  }

  async syncPermissions(routes: IRouteInfo[]) {
    this.logger.log(`Starting sync ${routes.length} permissions...`);

    try {
      // Bắt đầu transaction
      await this.permissionRepository.manager.transaction(async (manager) => {
        const permissionRepo = manager.getRepository(PermissionEntity);

        // Lấy tất cả permissions hiện tại
        const existingPermissions = await permissionRepo.find();
        const existingRoutes = new Set(
          existingPermissions.map((p) => `${p.method}:${p.path}`),
        );

        // Tìm routes mới cần thêm
        const newRoutes = routes.filter(
          (route) => !existingRoutes.has(`${route.method}:${route.path}`),
        );

        // Tìm routes cũ cần xóa (không còn trong code)
        const currentRoutes = new Set(
          routes.map((route) => `${route.method}:${route.path}`),
        );
        const routesToDelete = existingPermissions.filter(
          (p) => !currentRoutes.has(`${p.method}:${p.path}`),
        );

        // Insert routes mới
        if (newRoutes.length > 0) {
          const permissionsToInsert = newRoutes.map((route) =>
            permissionRepo.create({
              name: `${route.method} ${route.path}`,
              method: route.method as HttpMethod,
              path: route.path,
              module: route.module,
            }),
          );

          await permissionRepo.insert(permissionsToInsert);
          this.logger.log(`✅ Inserted ${newRoutes.length} new permissions`);
        }

        // Xóa routes cũ (optional - có thể comment nếu không muốn xóa)
        if (routesToDelete.length > 0) {
          const idsToDelete = routesToDelete.map((p) => p.id);
          await permissionRepo.delete(idsToDelete);
          this.logger.log(
            `🗑️  Deleted ${routesToDelete.length} old permissions`,
          );
        }

        // Cập nhật thông tin cho routes đã tồn tại
        // const routesToUpdate = routes.filter((route) =>
        //   existingRoutes.has(`${route.method}:${route.path}`),
        // );

        // for (const route of routesToUpdate) {
        //   await permissionRepo.update(
        //     { method: route.method as HttpMethod, path: route.path },
        //     {
        //       module: route.module,
        //     },
        //   );
        // }

        // if (routesToUpdate.length > 0) {
        //   this.logger.log(
        //     `🔄 Updated ${routesToUpdate.length} existing permissions`,
        //   );
        // }
      });

      this.logger.log('✅ Permission sync completed successfully');
    } catch (error) {
      this.logger.error('❌ Permission sync failed:', error);
      throw error;
    }
  }
}
