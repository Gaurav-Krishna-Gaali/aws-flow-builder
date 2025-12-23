import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateMachineController } from './state-machine.controller';
import { StateMachineService } from './state-machine.service';
import { StateMachine } from './entities/state-machine.entity';
import { Execution } from './entities/execution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StateMachine, Execution])],
  controllers: [StateMachineController],
  providers: [StateMachineService],
  exports: [StateMachineService],
})
export class StateMachineModule {}

