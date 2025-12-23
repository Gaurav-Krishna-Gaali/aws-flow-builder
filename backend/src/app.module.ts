import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StateMachineModule } from './state-machine/state-machine.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [StateMachineModule, LoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
