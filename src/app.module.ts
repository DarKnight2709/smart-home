import {
  ClassSerializerInterceptor,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user/user.module';
import helmet from 'helmet';
import compression from 'compression';
import { LoggerMiddleware } from './shared/middlewares/logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { RoleModule } from './modules/role/role.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtGuard } from './shared/guards/jwt.guard';
import { PermissionGuard } from './shared/guards/permission.guard';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuditContextInterceptor } from 'src/modules/audit-log/audit-context.interceptor';
import { PermissionModule } from './modules/permission/permission.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { DeviceModule } from './modules/device/device.module';
import { LivingRoomModule } from './modules/living-room/living-room.module';
import { BedroomModule } from './modules/bedroom/bedroom.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { OverviewModule } from './modules/overview/overview.module';
import { SocketModule } from './modules/socket/socket.module';
import { SettingModule } from './modules/setting/setting.module';
// import { WebSocketModule } from './modules/websocket/websocket.module'; // Tạm thời tắt Socket.IO
@Module({
  imports: [
    SharedModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    AuditLogModule,
    RoleModule,
    PermissionModule,
    DeviceModule,
    MqttModule,
    LivingRoomModule,
    BedroomModule,
    KitchenModule,
    OverviewModule,
    SocketModule, 
    SettingModule,
  ],
  controllers: [],
  providers: [
    // dùng để serialize response data (loại bỏ các field không cần thiết - các field có decorator @Exclude())
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(helmet(), compression(), LoggerMiddleware).forRoutes('*');
  }
}
