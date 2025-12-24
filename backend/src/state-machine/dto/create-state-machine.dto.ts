import { ApiProperty } from '@nestjs/swagger';

export class CreateStateMachineDto {
  @ApiProperty({
    description: 'Name of the state machine',
    example: 'MyStateMachine',
  })
  name: string;

  @ApiProperty({
    description: 'State machine definition (ASL JSON)',
    example: {
      Comment: 'A Hello World example',
      StartAt: 'HelloWorld',
      States: {
        HelloWorld: {
          Type: 'Pass',
          Result: 'Hello World!',
          End: true,
        },
      },
    },
  })
  definition: unknown;

  @ApiProperty({
    description: 'IAM Role ARN for the state machine execution',
    example: 'arn:aws:iam::123456789012:role/StepFunctionsRole',
    required: false,
  })
  roleArn?: string;
}


