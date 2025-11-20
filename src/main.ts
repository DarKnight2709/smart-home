// là class lõi của Nest để tạo Nestjs application
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './shared/services/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // get config
  const API_PREFIX = configService.get('API_PREFIX');
  const API_DEFAULT_VERSION = configService.get('API_DEFAULT_VERSION');
  const PORT = configService.get('PORT');
  const API_URL = configService.get('API_URL');



  // Start server
  try {
    await app.listen(PORT);
    console.log(`Server is running on ${API_URL}`, 'Bootstrap');
  } catch (error) {
    console.error(error, 'Bootstrap');
    process.exit(1);
  }
}
bootstrap();
