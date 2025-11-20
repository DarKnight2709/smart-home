import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { EnvironmentVariables, NodeEnv } from "src/configs/env.config";



@Injectable() 
export class ConfigService extends NestConfigService<EnvironmentVariables, true> {
  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return super.get(key, { infer: true });
  }

  get nodeEnv(): EnvironmentVariables['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === NodeEnv.DEVELOPMENT;
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.PRODUCTION;
  }

  get isTest(): boolean {
    return this.nodeEnv === NodeEnv.TEST;
  }
}
