import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SFNClient,
  CreateStateMachineCommand,
  DeleteStateMachineCommand,
  DescribeExecutionCommand,
  ListExecutionsCommand,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import { StateMachine } from './entities/state-machine.entity';
import { Execution } from './entities/execution.entity';
import { CreateStateMachineDto } from './dto/create-state-machine.dto';
import { StartExecutionDto } from './dto/start-execution.dto';

/**
 * StateMachineService
 * 
 * Architecture: This service is built on top of AWS Step Functions SDK (@aws-sdk/client-sfn).
 * AWS Step Functions is the source of truth for all state machine and execution operations.
 * 
 * Database Usage:
 * - PostgreSQL database is used for tracking, querying, and maintaining relationships
 * - Database stores metadata, definitions, and execution history
 * - Database operations are secondary to AWS SDK operations
 * 
 * Error Handling:
 * - If AWS SDK operation succeeds but database operation fails, the AWS operation is considered successful
 * - Warnings are logged for database failures to help identify sync issues
 * - This ensures AWS remains the authoritative source even if database has issues
 */
@Injectable()
export class StateMachineService {
  private readonly sfnClient: SFNClient;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StateMachine)
    private readonly stateMachineRepository: Repository<StateMachine>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {
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

  /**
   * Create a state machine in AWS Step Functions and save to database.
   * Architecture: AWS SDK is the source of truth for state machine operations.
   * Database is used for tracking and querying.
   * 
   * Flow: AWS SDK Create → Save to DB
   * If AWS succeeds but DB fails, the state machine exists in AWS but not tracked in DB.
   */
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

    let awsResponse;
    try {
      // Step 1: Create in AWS Step Functions (source of truth)
      const command = new CreateStateMachineCommand({
        name,
        definition: JSON.stringify(definition),
        roleArn: executionRoleArn,
        type: 'STANDARD',
      });

      awsResponse = await this.sfnClient.send(command);
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to create state machine in AWS Step Functions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 2: Save to database for tracking
    try {
      const stateMachine = this.stateMachineRepository.create({
        name,
        awsArn: awsResponse.stateMachineArn || null,
        definition: definition as Record<string, unknown>,
        roleArn: executionRoleArn,
        type: 'STANDARD',
        status: 'ACTIVE',
        awsCreationDate: awsResponse.creationDate || null,
      });

      await this.stateMachineRepository.save(stateMachine);
    } catch (error) {
      // AWS creation succeeded but DB save failed
      // Log warning but don't fail the request since AWS operation succeeded
      console.error(
        `Warning: State machine created in AWS (${awsResponse.stateMachineArn}) but failed to save to database:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Still return success since AWS operation succeeded
    }

    return {
      success: true,
      stateMachineArn: awsResponse.stateMachineArn,
      creationDate: awsResponse.creationDate,
      message: 'State machine created successfully!',
    };
  }

  /**
   * List all state machines from database.
   * Note: This queries the database which tracks state machines created via AWS SDK.
   * The database is the source for listing/querying operations.
   */
  async listStateMachines(): Promise<{
    success: boolean;
    stateMachines: Array<{
      stateMachineArn: string | null;
      name: string;
      status: string;
      creationDate: Date | null;
      type: string;
      definition: Record<string, unknown>;
    }>;
  }> {
    try {
      const stateMachines = await this.stateMachineRepository.find({
        order: { createdAt: 'DESC' },
      });

      return {
        success: true,
        stateMachines: stateMachines.map((sm) => ({
          stateMachineArn: sm.awsArn,
          name: sm.name,
          status: sm.status,
          creationDate: sm.awsCreationDate || sm.createdAt,
          type: sm.type,
          definition: sm.definition,
        })),
      };
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to list state machines',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a state machine from AWS Step Functions and database.
   * Architecture: AWS SDK is the source of truth.
   * 
   * Flow: AWS SDK Delete → Delete from DB
   * If AWS succeeds but DB fails, the state machine is deleted from AWS but may remain in DB.
   */
  async deleteStateMachine(stateMachineArn?: string) {
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required parameter: stateMachineArn');
    }

    try {
      // Step 1: Delete from AWS Step Functions (source of truth)
      const command = new DeleteStateMachineCommand({
        stateMachineArn,
      });
      await this.sfnClient.send(command);
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to delete state machine from AWS Step Functions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 2: Delete from database
    try {
      const stateMachine = await this.stateMachineRepository.findOne({
        where: { awsArn: stateMachineArn },
      });

      if (stateMachine) {
        await this.stateMachineRepository.remove(stateMachine);
      }
    } catch (error) {
      // AWS deletion succeeded but DB delete failed
      console.error(
        `Warning: State machine deleted from AWS (${stateMachineArn}) but failed to delete from database:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Still return success since AWS operation succeeded
    }

    return { success: true, message: 'State machine deleted successfully!' };
  }

  async listExecutions(stateMachineArn?: string, maxResults = 10) {
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required parameter: stateMachineArn');
    }

    try {
      // Find state machine in database
      const stateMachine = await this.stateMachineRepository.findOne({
        where: { awsArn: stateMachineArn },
      });

      if (!stateMachine) {
        throw new NotFoundException('State machine not found');
      }

      // Query executions from database
      const executions = await this.executionRepository.find({
        where: { awsStateMachineArn: stateMachineArn },
        order: { awsStartDate: 'DESC' },
        take: maxResults,
      });

      return {
        success: true,
        executions: executions.map((exec) => ({
          executionArn: exec.awsExecutionArn,
          name: exec.name,
          status: exec.status,
          startDate: exec.awsStartDate,
          stopDate: exec.awsStopDate,
          stateMachineArn: exec.awsStateMachineArn,
          input: exec.input,
          output: exec.output,
          error: exec.error,
          cause: exec.cause,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
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
      // Query from database first
      const execution = await this.executionRepository.findOne({
        where: { awsExecutionArn: executionArn },
      });

      if (execution) {
        return {
          success: true,
          executionArn: execution.awsExecutionArn,
          stateMachineArn: execution.awsStateMachineArn,
          name: execution.name,
          status: execution.status,
          startDate: execution.awsStartDate,
          stopDate: execution.awsStopDate,
          input: execution.input,
          output: execution.output,
          error: execution.error,
          cause: execution.cause,
        };
      }

      // If not found in DB, try AWS (for backward compatibility)
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

  /**
   * Start an execution in AWS Step Functions and save to database.
   * Architecture: AWS SDK is the source of truth for execution operations.
   * 
   * Flow: Verify in DB → AWS SDK Start → Save to DB
   * If AWS succeeds but DB save fails, execution runs in AWS but not tracked in DB.
   */
  async startExecution(dto: StartExecutionDto) {
    const { stateMachineArn, input, name } = dto;
    if (!stateMachineArn) {
      throw new BadRequestException('Missing required field: stateMachineArn');
    }

    // Step 1: Verify state machine exists in database
    const stateMachine = await this.stateMachineRepository.findOne({
      where: { awsArn: stateMachineArn },
    });

    if (!stateMachine) {
      throw new NotFoundException('State machine not found');
    }

    let awsResponse;
    try {
      // Step 2: Start execution in AWS Step Functions (source of truth)
      const command = new StartExecutionCommand({
        stateMachineArn,
        input: input ? JSON.stringify(input) : '{}',
        name,
      });

      awsResponse = await this.sfnClient.send(command);
    } catch (error) {
      throw new InternalServerErrorException({
        error: 'Failed to start execution in AWS Step Functions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 3: Save execution to database for tracking
    try {
      const execution = this.executionRepository.create({
        awsExecutionArn: awsResponse.executionArn || '',
        awsStateMachineArn: stateMachineArn,
        name: name || null,
        status: 'RUNNING',
        input: (input as Record<string, unknown>) || null,
        awsStartDate: awsResponse.startDate || null,
        stateMachineId: stateMachine.id,
      });

      await this.executionRepository.save(execution);
    } catch (error) {
      // AWS start succeeded but DB save failed
      console.error(
        `Warning: Execution started in AWS (${awsResponse.executionArn}) but failed to save to database:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Still return success since AWS operation succeeded
    }

    // Return full execution details for immediate display
    return {
      success: true,
      executionArn: awsResponse.executionArn,
      name: name || null,
      status: 'RUNNING',
      startDate: awsResponse.startDate,
      stateMachineArn: stateMachineArn,
      input: input || null,
      message: 'Execution started successfully!',
    };
  }

  // Helper method to sync execution status from AWS (can be called periodically)
  async syncExecutionStatus(executionArn: string) {
    try {
      const execution = await this.executionRepository.findOne({
        where: { awsExecutionArn: executionArn },
      });

      if (!execution) {
        return;
      }

      // Get latest status from AWS
      const command = new DescribeExecutionCommand({
        executionArn,
      });

      const response = await this.sfnClient.send(command);

      // Update execution in database
      execution.status = response.status || execution.status;
      execution.awsStopDate = response.stopDate || execution.awsStopDate;
      
      if (response.input) {
        try {
          execution.input = JSON.parse(response.input) as Record<string, unknown>;
        } catch {
          // Keep existing input if parsing fails
        }
      }

      if (response.output) {
        try {
          execution.output = JSON.parse(response.output) as Record<string, unknown>;
        } catch {
          // Keep existing output if parsing fails
        }
      }

      execution.error = response.error || execution.error;
      execution.cause = response.cause || execution.cause;

      await this.executionRepository.save(execution);
    } catch (error) {
      console.error('Failed to sync execution status:', error);
    }
  }
}

