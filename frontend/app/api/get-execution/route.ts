import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, DescribeExecutionCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionArn = searchParams.get('executionArn');

    if (!executionArn) {
      return NextResponse.json(
        { error: 'Missing required parameter: executionArn' },
        { status: 400 }
      );
    }

    const command = new DescribeExecutionCommand({
      executionArn: executionArn,
    });

    const response = await sfnClient.send(command);

    // Parse input and output if they exist
    let input = null;
    let output = null;
    
    try {
      input = response.input ? JSON.parse(response.input) : null;
    } catch (e) {
      input = response.input;
    }

    try {
      output = response.output ? JSON.parse(response.output) : null;
    } catch (e) {
      output = response.output;
    }

    return NextResponse.json({
      success: true,
      executionArn: response.executionArn,
      stateMachineArn: response.stateMachineArn,
      name: response.name,
      status: response.status,
      startDate: response.startDate,
      stopDate: response.stopDate,
      input: input,
      output: output,
      error: response.error,
      cause: response.cause,
    });
  } catch (error) {
    console.error('Error getting execution:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to get execution details',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}


