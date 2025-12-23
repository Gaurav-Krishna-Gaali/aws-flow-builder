import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { StateMachineService } from './state-machine.service';
import { CreateStateMachineDto } from './dto/create-state-machine.dto';
import { StartExecutionDto } from './dto/start-execution.dto';

@ApiTags('state-machines', 'executions')
@Controller()
export class StateMachineController {
  constructor(private readonly stateMachineService: StateMachineService) {}

  @Get('state-machines')
  @ApiOperation({ summary: 'List all state machines' })
  @ApiResponse({
    status: 200,
    description: 'List of state machines retrieved successfully',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  listStateMachines() {
    return this.stateMachineService.listStateMachines();
  }

  @Post('state-machines')
  @ApiOperation({ summary: 'Create a new state machine' })
  @ApiBody({ type: CreateStateMachineDto })
  @ApiResponse({
    status: 201,
    description: 'State machine created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing required fields',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  createStateMachine(@Body() body: CreateStateMachineDto) {
    return this.stateMachineService.createStateMachine(body);
  }

  @Delete('state-machines')
  @ApiOperation({ summary: 'Delete a state machine' })
  @ApiQuery({
    name: 'stateMachineArn',
    description: 'ARN of the state machine to delete',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'State machine deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing stateMachineArn',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  deleteStateMachine(@Query('stateMachineArn') stateMachineArn?: string) {
    return this.stateMachineService.deleteStateMachine(
      stateMachineArn || undefined,
    );
  }

  @Post('executions')
  @ApiOperation({ summary: 'Start a new execution' })
  @ApiBody({ type: StartExecutionDto })
  @ApiResponse({
    status: 201,
    description: 'Execution started successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing required fields',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  startExecution(@Body() body: StartExecutionDto) {
    return this.stateMachineService.startExecution(body);
  }

  @Get('executions')
  @ApiOperation({ summary: 'List executions for a state machine' })
  @ApiQuery({
    name: 'stateMachineArn',
    description: 'ARN of the state machine',
    required: true,
  })
  @ApiQuery({
    name: 'maxResults',
    description: 'Maximum number of results to return',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of executions retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing stateMachineArn',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  listExecutions(
    @Query('stateMachineArn') stateMachineArn?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    const parsedMaxResults = maxResults ? parseInt(maxResults, 10) : 10;
    return this.stateMachineService.listExecutions(
      stateMachineArn || undefined,
      parsedMaxResults,
    );
  }

  @Get('executions/:executionArn')
  @ApiOperation({ summary: 'Get execution details' })
  @ApiParam({ name: 'executionArn', description: 'ARN of the execution' })
  @ApiResponse({
    status: 200,
    description: 'Execution details retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing executionArn',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  describeExecution(@Param('executionArn') executionArn?: string) {
    return this.stateMachineService.describeExecution(
      executionArn || undefined,
    );
  }
}
