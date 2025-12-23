import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SFNClient,
  CreateStateMachineCommand,
  DeleteStateMachineCommand,
  DescribeExecutionCommand,
  ListExecutionsCommand,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';

type CreateStateMachineDto = {
  name: string;
  definition: unknown;
  roleArn?: string;
};

type StartExecutionDto = {
  stateMachineArn: string;
  input?: unknown;
  name?: string;
};

@Injectable()
export class StateMachineService {
  private readonly sfnClient: SFNClient;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

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

  async createStateMachine(dto: CreateStateMachineDto) {
    const { name, definition, roleArn } = dto;
    if (!name || !definition) {
      throw new BadRequestException('Missing required fields: name and definition');
    }

    const executionRoleArn = roleArn || this.configService.get<string>('AWS_STEP_FUNCTIONS_ROLE_ARN');
    if (!executionRoleArn) {
      throw new BadRequestException(
        'Missing IAM Role ARN. Provide AWS_STEP_FUNCTIONS_ROLE_ARN or pass roleArn in request body.',
      );
    }

    try {
      const command = new CreateStateMachineCommand({
        name,
        definition: JSON.stringify(definition),
        roleArn: executionRoleArn,
        type: 'STANDARD',
      });

      const response = await this.sfnClient.send(command);
      return {
        success: true,
        stateMachineArn: response.stateMachineArn,
        creationDate: response.creationDate,
        message: 'State machine created successfully!',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to create state machine',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteStateMachine(stateMachineArn?: string) {
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required parameter: stateMachineArn');
    }

    try {
      const command = new DeleteStateMachineCommand({
        stateMachineArn,
      });
      await this.sfnClient.send(command);

      return { success: true, message: 'State machine deleted successfully!' };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to delete state machine',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async listExecutions(stateMachineArn?: string, maxResults = 10) {
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required parameter: stateMachineArn');
    }

    try {
      const command = new ListExecutionsCommand({
        stateMachineArn,
        maxResults,
      });

      const response = await this.sfnClient.send(command);
      return {
        success: true,
        executions: response.executions || [],
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to list executions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async describeExecution(executionArn?: string) {
    if (!executionArn) {
      throw new BadRequestException('Missing required parameter: executionArn');
    }

    try {
      const command = new DescribeExecutionCommand({
        executionArn,
      });

      const response = await this.sfnClient.send(command);

      let input: unknown = null;
      let output: unknown = null;

      try {
        input = response.input ? JSON.parse(response.input) : null;
      } catch {
        input = response.input;
      }

      try {
        output = response.output ? JSON.parse(response.output) : null;
      } catch {
        output = response.output;
      }

      return {
        success: true,
        executionArn: response.executionArn,
        stateMachineArn: response.stateMachineArn,
        name: response.name,
        status: response.status,
        startDate: response.startDate,
        stopDate: response.stopDate,
        input,
        output,
        error: response.error,
        cause: response.cause,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to get execution details',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async startExecution(dto: StartExecutionDto) {
    const { stateMachineArn, input, name } = dto;
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required field: stateMachineArn');
    }

    try {
      const command = new StartExecutionCommand({
        stateMachineArn,
        input: input ? JSON.stringify(input) : '{}',
        name,
      });

      const response = await this.sfnClient.send(command);

      return {
        success: true,
        executionArn: response.executionArn,
        startDate: response.startDate,
        message: 'Execution started successfully!',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to start execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

