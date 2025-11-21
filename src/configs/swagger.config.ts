import { ConfigService } from 'src/shared/services/config.service';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';

export const configSwagger = (
  app: INestApplication,
  configService: ConfigService
) => {
  const API_URL = configService.get("API_URL");
  const SWAGGER_UI_ENABLED = true;
  const SWAGGER_TITLE = configService.get("SWAGGER_TITLE");
  const SWAGGER_DESCRIPTION = configService.get('SWAGGER_DESCRIPTION');
  const SWAGGER_VERSION = configService.get('SWAGGER_VERSION');
  const SWAGGER_UI_PATH = configService.get('SWAGGER_UI_PATH');


  const configSwagger = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .addServer(API_URL)
    // dùng để khai báo: "API này dùng cơ chế Bearer Token (JWT) để xác thực, token phải được gửi trong header Authorization"
    .addBearerAuth(
      {
        type: 'http',
        // quy định dùng bearer Authentication
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT Authorization header using the Bearer scheme',
      },
      // tên của security key mà Swagger dùng để liên kết với decorator.
      'Authorization',
    )
    .build();
  const documentSwagger = SwaggerModule.createDocument(app, configSwagger);

  // tự động gán security (Bearer Auth) cho tất cả các endpoint 
  // kể cả nhưng endpoint mà không viết @ApiBearerAuth()
  documentSwagger.paths = Object.entries(documentSwagger.paths).reduce(
    (acc, [path, pathObj]) => {
      for (const method in pathObj) {
        if (pathObj[method]?.security === undefined) {
          pathObj[method].security = [{ Authorization: [] }];
        }
      }
      acc[path] = pathObj;
      return acc;
    },
    {} as typeof documentSwagger.paths,
  );

  // tạo trang Swagger UI 
  // Mount trang đó vào nestjs app
  // cấu hình tùy chỉnh (options)
  SwaggerModule.setup(SWAGGER_UI_PATH, app, documentSwagger, {
    // ấn Authorize và nhập token JWT trong Swagger
    // Token được lưu trong LocalStorage
    swaggerOptions: {
      // F5 hoặc reload trang -> không mất token
      persistAuthorization: true,
    },
    customSiteTitle: SWAGGER_TITLE,
    swaggerUiEnabled: SWAGGER_UI_ENABLED,
  });

  return {
    swaggerEnabled: SWAGGER_UI_ENABLED,
    swaggerUrl: `${API_URL}/${SWAGGER_UI_PATH}`
  }
}

