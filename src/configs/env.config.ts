import { Transform, plainToClass } from "class-transformer";


import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
} from 'class-validator';


export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const; 

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv] // -> type NodeEnv = "development" | "production" | "test"

export class EnvironmentValidation {
  // Application 
  @IsEnum(NodeEnv) // validation
  @Transform(({ value }) => value || NodeEnv.DEVELOPMENT) // this run before validation and modify the input
  NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value, 10): 4001))
  PORT: number = 4001;


  @IsString()
  @Transform(({ value }) => value.trim().replace(/^\/+|\/+$/g, '') || 'api')
  API_PREFIX: string;


  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  API_DEFAULT_VERSION: number;

  @IsString()
  API_URL: string;

  @IsString()
  CLIENT_URL: string;



    // Database
  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 3306))
  DB_PORT: number = 3306;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;
}


export function validateConfig(config: Record<string, unknown>) {
  // tạo object theo class EnvironmentValidation
  const validatedConfig = plainToClass(EnvironmentValidation, config, {
    enableImplicitConversion: true,
  });

  // kiểm trả lỗi (thiếu property và sai kiểu)
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    errors.map((error) =>
      console.error(
        'Biến môi trường không hợp lệ:',
        Object.values(error.constraints ?? {}).join(', '),
      ),
    );
    throw new Error('Biến môi trường không hợp lệ');
  }

  return validatedConfig;

}

export type EnvironmentVariables = EnvironmentValidation;
// type EnvironmentVariables = {
//   PORT: number;
//   DB_HOST: string;
//   API_URL: string;
//  .....
// };

export default () => {
  try {
    const env = validateConfig(process.env)
    return env;
  } catch (error) {
    console.log('Biến môi trường không hợp lệ: ', error);
    throw new Error('Biến môi trường không hợp lệ')
  }
}