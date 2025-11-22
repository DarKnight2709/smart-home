import { MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './modules/user/user.module';
import helmet from 'helmet';
import compression from "compression";
import { LoggerMiddleware } from './shared/middlewares/logger.middleware';

@Module({
  imports: [
   SharedModule,
   DatabaseModule,
   UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
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
