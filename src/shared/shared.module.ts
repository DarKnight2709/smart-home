import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import envConfig from "src/configs/env.config";
import { ConfigService } from "./services/config.service";

// global module 
// every module can use its services without importing
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // load used to get information (EX in the ConfigService: this.configService.get('port'); )
      load: [envConfig],
    })
  ],
  providers: [
    ConfigService // use the load above to get information
  ]
})

export class SharedModule {}