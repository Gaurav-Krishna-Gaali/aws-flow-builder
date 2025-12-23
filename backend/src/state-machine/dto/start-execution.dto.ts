import { ApiProperty } from '@nestjs/swagger';

export class StartExecutionDto {
  @ApiProperty({
    description: 'ARN of the state machine to execute',
    example: 'arn:aws:states:us-east-1:123456789012:stateMachine:MyStateMachine',
  })
  stateMachineArn: string;

  @ApiProperty({
    description: 'Input data for the execution',
    example: { key: 'value' },
    required: false,
  })
  input?: unknown;

  @ApiProperty({
    description: 'Name of the execution',
    example: 'my-execution-2024',
    required: false,
  })
  name?: string;
}

