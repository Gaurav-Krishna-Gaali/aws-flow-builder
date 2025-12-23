import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StateMachineModule } from './state-machine/state-machine.module';

@Module({
  imports: [StateMachineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
