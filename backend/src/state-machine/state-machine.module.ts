import { Module } from '@nestjs/common';
import { StateMachineController } from './state-machine.controller';
import { StateMachineService } from './state-machine.service';

@Module({
  controllers: [StateMachineController],
  providers: [StateMachineService],
})
export class StateMachineModule {}

