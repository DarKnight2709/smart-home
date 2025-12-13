// quét hết route của hệ thống, rồi đồng bộ sync các route đó thành permissions trong database.

import { INestApplication, Logger, RequestMethod, VersioningType } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { PermissionService } from 'src/modules/permission/permission.service';
import { IS_PROTECTED_KEY } from 'src/shared/decorators/protected.decorator';
import { IS_PUBLIC_KEY } from 'src/shared/decorators/public.decorator';
import { IRouteInfo } from 'src/shared/types';
import { ConfigService } from 'src/shared/services/config.service';
import { AppModule } from '../app.module';

function buildFullPath(...segments: string[]) {
  // 1. Lọc bỏ các segment không phải string hoặc rỗng
  const validSegments = segments
    .filter((seg) => typeof seg === 'string' && seg.trim() !== '')
    .map((seg) => seg.trim());

  // 2. Bỏ tất cả dấu '/' ở đầu/cuối từng segment, rồi ghép chúng lại
  const joined = validSegments
    .map((seg) => seg.replace(/^\/+|\/+$/g, '')) // xóa slash đầu và cuối của mỗi segment
    .join('/'); // ghép bằng '/'

  // 3. Thêm slash dẫn đầu, loại bỏ slash thừa, xóa slash cuối
  return ('/' + joined) // đảm bảo có slash đầu
    .replace(/\/+/g, '/') // xóa slash thừa
    .replace(/\/$/, ''); // xóa slash cuối
}

// Sử dụng RequestMethod enum từ NestJS
function getHttpMethodName(methodCode: number): string {
  const methodNames = {
    [RequestMethod.GET]: 'GET',
    [RequestMethod.POST]: 'POST',
    [RequestMethod.PUT]: 'PUT',
    [RequestMethod.DELETE]: 'DELETE',
    [RequestMethod.PATCH]: 'PATCH',
    [RequestMethod.ALL]: 'ALL',
    [RequestMethod.OPTIONS]: 'OPTIONS',
    [RequestMethod.HEAD]: 'HEAD',
    [RequestMethod.SEARCH]: 'SEARCH',
  };

  return methodNames[methodCode] || `UNKNOWN(${methodCode})`;
}

function getRoutesInfo(app: INestApplication): IRouteInfo[] {
  const routes: IRouteInfo[] = [];

  try {
    // Lấy ModulesContainer
    const modulesContainer = (app as any).container?.modules;

    if (!modulesContainer) {
      console.log('Could not access modules container');
      return routes;
    }

    // Duyệt qua tất cả modules
    for (const [moduleKey, moduleWrapper] of modulesContainer) {
      const moduleRef = moduleWrapper?.metatype;
      const moduleName = moduleRef?.name || 'UnknownModule';

      // Duyệt qua controllers của module
      const controllers = moduleWrapper?.controllers;
      if (!controllers) continue;

      for (const [controllerKey, controllerWrapper] of controllers) {
        const controllerRef = controllerWrapper?.metatype;
        const controllerName = controllerRef?.name || 'UnknownController';

        // Lấy base path của controller
        const controllerPath =
          Reflect.getMetadata(PATH_METADATA, controllerRef) || '';

        // Lấy tất cả methods của controller
        const prototype = controllerRef?.prototype;
        if (!prototype) continue;

        const methodNames = Object.getOwnPropertyNames(prototype);

        methodNames.forEach((methodName) => {
          if (methodName === 'constructor') return;

          const method = prototype[methodName];
          if (typeof method !== 'function') return;

          // Lấy metadata
          const methodPath = Reflect.getMetadata(PATH_METADATA, method);
          const httpMethodCode = Reflect.getMetadata(METHOD_METADATA, method);

          if (methodPath !== undefined && httpMethodCode !== undefined) {
            // Kiểm tra xem controller hoặc method có được đánh dấu IsPublic hoặc IsProtected không
            const isPublicOnController = Reflect.getMetadata(
              IS_PUBLIC_KEY,
              controllerRef,
            );
            const isPublicOnMethod = Reflect.getMetadata(IS_PUBLIC_KEY, method);
            const isProtectedOnController = Reflect.getMetadata(
              IS_PROTECTED_KEY,
              controllerRef,
            );
            const isProtectedOnMethod = Reflect.getMetadata(
              IS_PROTECTED_KEY,
              method,
            );

            // Bỏ qua nếu có decorator IsPublic hoặc IsProtected
            if (
              isPublicOnController ||
              isPublicOnMethod ||
              isProtectedOnController ||
              isProtectedOnMethod
            ) {
              return;
            }

            const fullPath = buildFullPath(controllerPath, methodPath);

            // Convert method code to string
            const methodString = getHttpMethodName(httpMethodCode);

            routes.push({
              module: moduleName,
              controller: controllerName,
              method: methodString,
              path: fullPath,
              handler: methodName,
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Error getting routes info:', error);
  }

  return routes;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = new Logger('Init permissions');
  const configService = app.get(ConfigService);

  // Đồng bộ prefix/version giống main.ts để path trùng khớp runtime
  const API_PREFIX = configService.get('API_PREFIX');
  const API_DEFAULT_VERSION = configService.get('API_DEFAULT_VERSION');
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: String(API_DEFAULT_VERSION),
  });

  await app.init();

  const permissionService = app.get(PermissionService);

  // Lấy thông tin routes
  const routes = getRoutesInfo(app);

  if (routes.length === 0) {
    logger.log('No routes found');
  } else {
    logger.log(`Syncing ${routes.length} permissions...`);
    await permissionService.syncPermissions(routes);
  }

  logger.log('Permissions synced successfully');

  await app.close();
  // Dừng chương trình khi chạy xong
  process.exit(0);
}
bootstrap();
