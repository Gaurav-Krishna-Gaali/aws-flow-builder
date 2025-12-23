import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stateMachineArn, input, name } = body;

    if (!stateMachineArn) {
      return NextResponse.json(
        { error: 'Missing required field: stateMachineArn' },
        { status: 400 }
      );
    }

    const command = new StartExecutionCommand({
      stateMachineArn: stateMachineArn,
      input: input ? JSON.stringify(input) : '{}',
      name: name, // Optional execution name
    });

    const response = await sfnClient.send(command);

    return NextResponse.json({
      success: true,
      executionArn: response.executionArn,
      startDate: response.startDate,
      message: 'Execution started successfully!',
    });
  } catch (error) {
    console.error('Error starting execution:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to start execution',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}


