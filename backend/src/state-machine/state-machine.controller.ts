import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { StateMachineService } from './state-machine.service';
import { CreateStateMachineDto } from './dto/create-state-machine.dto';
import { StartExecutionDto } from './dto/start-execution.dto';
import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  DescribeExecutionCommandOutput,
} from '@aws-sdk/client-sfn';

@ApiTags('state-machines', 'executions')
@Controller()
export class StateMachineController {
  private readonly sfnClient: SFNClient;

  constructor(
    private readonly stateMachineService: StateMachineService,
    private readonly configService: ConfigService,
  ) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.sfnClient = new SFNClient({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

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

  @Post('executions/direct')
  @ApiOperation({
    summary: 'Start execution directly via AWS SDK (bypasses service layer)',
  })
  @ApiBody({ type: StartExecutionDto })
  @ApiResponse({
    status: 201,
    description: 'Raw AWS response',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing required fields',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async startExecutionDirect(@Body() body: StartExecutionDto): Promise<{
    success: boolean;
    rawResponse?: unknown;
    executionArn?: string;
    startDate?: Date;
    status?: string;
    stopDate?: Date;
    input?: unknown;
    output?: unknown;
    error?: string;
    cause?: string;
    details?: unknown;
  }> {
    const { stateMachineArn, input, name } = body;
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required field: stateMachineArn');
    }

    try {
      // Step 1: Start execution
      const startCommand = new StartExecutionCommand({
        stateMachineArn,
        input: input ? JSON.stringify(input) : '{}',
        name,
      });

      const startResponse = await this.sfnClient.send(startCommand);

      if (!startResponse.executionArn) {
        throw new Error('Failed to get execution ARN from AWS');
      }

      // Step 2: Fetch execution details with retries to get the final status
      // For fast-failing executions, AWS might need a moment to update the status
      let describeResponse: DescribeExecutionCommandOutput | null = null;
      const maxRetries = 5;
      const retryDelay = 200; // 200ms between retries

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }

        const describeCommand = new DescribeExecutionCommand({
          executionArn: startResponse.executionArn,
        });

        describeResponse = await this.sfnClient.send(describeCommand);

        // If execution is in a final state, we have the final status
        const finalStates = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'];
        if (
          describeResponse.status &&
          finalStates.includes(describeResponse.status)
        ) {
          break;
        }

        // If still running after a few attempts, return current status
        if (attempt === maxRetries - 1) {
          break;
        }
      }

      if (!describeResponse) {
        throw new Error('Failed to get execution details from AWS');
      }

      // Parse input/output if they exist
      let parsedInput: unknown = null;
      let parsedOutput: unknown = null;

      if (describeResponse.input) {
        try {
          parsedInput = JSON.parse(describeResponse.input);
        } catch {
          parsedInput = describeResponse.input;
        }
      }

      if (describeResponse.output) {
        try {
          parsedOutput = JSON.parse(describeResponse.output);
        } catch {
          parsedOutput = describeResponse.output;
        }
      }

      // Return the raw AWS response with all fields from both commands
      return {
        success: true,
        rawResponse: {
          startExecution: startResponse,
          describeExecution: describeResponse,
        },
        executionArn: startResponse.executionArn,
        startDate: describeResponse.startDate,
        status: describeResponse.status, // Use actual status from AWS
        stopDate: describeResponse.stopDate,
        input: parsedInput,
        output: parsedOutput,
        error: describeResponse.error,
        cause: describeResponse.cause,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to start execution in AWS Step Functions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
