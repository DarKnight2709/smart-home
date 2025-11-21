// là class lõi của Nest để tạo Nestjs application
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './shared/services/config.service';
import { configSwagger } from './configs/swagger.config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // get config
  const API_PREFIX = configService.get('API_PREFIX');
  const API_DEFAULT_VERSION = configService.get('API_DEFAULT_VERSION');
  const PORT = configService.get('PORT');
  const API_URL = configService.get('API_URL');



  // Set global prefix and versioning (/api/v1)
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: String(API_DEFAULT_VERSION),
  });

  // Setup Swagger
  const { swaggerEnabled, swaggerUrl } = configSwagger(app, configService);





  // Start server
  try {
    await app.listen(PORT);
    Logger.log(`Server is running on ${API_URL}`, 'Bootstrap');

    if(swaggerEnabled) {
      Logger.log(`Swager is running on ${swaggerUrl}`, 'Bootstrap')
    }
  } catch (error) {
    Logger.error(error, 'Bootstrap');
    process.exit(1);
  }
}
bootstrap();
