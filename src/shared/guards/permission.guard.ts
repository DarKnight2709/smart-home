import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { VERSION_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { IS_PROTECTED_KEY } from '../decorators/protected.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ConfigService } from '../services/config.service';
import { IRequest } from '../types';
import buildFullPath from '../utils/buildFullPath';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Endpoint public thì không cần kiểm tra permission
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Endpoint protected thì cần kiểm tra permission (protected là có jwt nhưng không cần permission guard)
    const isProtected = this.reflector.getAllAndOverride<boolean>(
      IS_PROTECTED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isProtected) {
      return true;
    }

    const request = context.switchToHttp().getRequest<IRequest>();
    // lấy user từ request đã được nạp ở khâu jwt guard
    const user = request.user;

    // Nếu có role hệ thống thì không cần kiểm tra permission (role hệ thống có quyền truy cập tất cả)
    const hasSystemRole = user.roles.some((role) => role.isSystemRole);
    if (hasSystemRole) {
      return true;
    }

    // api
    const apiPrefix = this.configService.get('API_PREFIX');
    // v1
    const defaultApiVersion = this.configService.get('API_DEFAULT_VERSION');

    // lấy version của route, nếu route có decorator @Version('2')
    const apiVersion = this.reflector.getAllAndOverride<string>(
      VERSION_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // Kiểm tra user có quyền truy cập endpoint này không
    // lấy tất cả các mảng permission của mỗi role và gộp thành 1 mảng duy nhất
    // [
      // [
      //   {name: 'Read', method: 'GET', path: '/users'},
      //   {name: 'Write', method: 'POST', path: '/users'},
      //   {name: 'Delete', method: 'DELETE', path: '/users'}
      // ]
    // ]
    const permissions = user.roles.flatMap((role) => role.permissions);

    const version = apiVersion || defaultApiVersion;
    // /api/v1
    const defaultPath = buildFullPath(apiPrefix, `v${String(version)}`);
    // /api/v1/users -> replace -> /users 
    const pathSerialized = request.route.path.replace(defaultPath, '');


    const hasPermission = permissions.some(
      (permission) =>
        permission?.method === request.method &&
        permission?.path === pathSerialized,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này',
      );
    }

    return true;
  }
}
