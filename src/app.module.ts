import { MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import { AppController } from './app.controller';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user/user.module';
import helmet from 'helmet';
import compression from "compression";
import { LoggerMiddleware } from './shared/middlewares/logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './shared/guards/jwt.guard';
import { PermissionGuard } from './shared/guards/permission.guard';

@Module({
  imports: [
   SharedModule,
   DatabaseModule,
   UserModule,
   AuthModule
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        helmet(),
        compression(),
        LoggerMiddleware

      )
      .forRoutes('*');
  }

}
