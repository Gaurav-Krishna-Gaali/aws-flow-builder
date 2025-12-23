import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, DeleteStateMachineCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stateMachineArn = searchParams.get('stateMachineArn');

    if (!stateMachineArn) {
      return NextResponse.json(
        { error: 'Missing required parameter: stateMachineArn' },
        { status: 400 }
      );
    }

    const command = new DeleteStateMachineCommand({
      stateMachineArn: stateMachineArn,
    });

    await sfnClient.send(command);

    return NextResponse.json({
      success: true,
      message: 'State machine deleted successfully!',
    });
  } catch (error) {
    console.error('Error deleting state machine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to delete state machine',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}


