import { Controller, Post, Delete, Get, Body, Query, Param } from '@nestjs/common';
import { StateMachineService } from './state-machine.service';

@Controller()
export class StateMachineController {
  constructor(private readonly stateMachineService: StateMachineService) {}

  @Post('state-machines')
  createStateMachine(@Body() body: { name: string; definition: unknown; roleArn?: string }) {
    return this.stateMachineService.createStateMachine(body);
  }

  @Delete('state-machines')
  deleteStateMachine(@Query('stateMachineArn') stateMachineArn?: string) {
    return this.stateMachineService.deleteStateMachine(stateMachineArn || undefined);
  }

  @Post('executions')
  startExecution(@Body() body: { stateMachineArn: string; input?: unknown; name?: string }) {
    return this.stateMachineService.startExecution(body);
  }

  @Get('executions')
  listExecutions(@Query('stateMachineArn') stateMachineArn?: string, @Query('maxResults') maxResults?: string) {
    const parsedMaxResults = maxResults ? parseInt(maxResults, 10) : 10;
    return this.stateMachineService.listExecutions(stateMachineArn || undefined, parsedMaxResults);
  }

  @Get('executions/:executionArn')
  describeExecution(@Param('executionArn') executionArn?: string) {
    return this.stateMachineService.describeExecution(executionArn || undefined);
  }
}

