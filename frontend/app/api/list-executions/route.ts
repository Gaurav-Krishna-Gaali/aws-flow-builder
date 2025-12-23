import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, ListExecutionsCommand } from '@aws-sdk/client-sfn';

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
    const stateMachineArn = searchParams.get('stateMachineArn');
    const maxResults = parseInt(searchParams.get('maxResults') || '10');

    if (!stateMachineArn) {
      return NextResponse.json(
        { error: 'Missing required parameter: stateMachineArn' },
        { status: 400 }
      );
    }

    const command = new ListExecutionsCommand({
      stateMachineArn: stateMachineArn,
      maxResults: maxResults,
    });

    const response = await sfnClient.send(command);

    return NextResponse.json({
      success: true,
      executions: response.executions || [],
    });
  } catch (error) {
    console.error('Error listing executions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to list executions',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}


