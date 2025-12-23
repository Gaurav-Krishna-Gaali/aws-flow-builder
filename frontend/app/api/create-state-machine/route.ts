import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, CreateStateMachineCommand } from '@aws-sdk/client-sfn';

// Initialize AWS Step Functions client
// In production, credentials should come from environment variables or IAM roles
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
    const { name, definition, roleArn } = body;

    if (!name || !definition) {
      return NextResponse.json(
        { error: 'Missing required fields: name and definition' },
        { status: 400 }
      );
    }

    // Get role ARN from request or environment variable
    const executionRoleArn = roleArn || process.env.AWS_STEP_FUNCTIONS_ROLE_ARN;
    
    if (!executionRoleArn) {
      return NextResponse.json(
        { 
          error: 'Missing IAM Role ARN',
          details: 'Please provide AWS_STEP_FUNCTIONS_ROLE_ARN in your .env.local file or pass roleArn in the request. See AWS_SETUP.md for instructions on creating the role.',
        },
        { status: 400 }
      );
    }

    // Create the state machine
    const command = new CreateStateMachineCommand({
      name: name,
      definition: JSON.stringify(definition),
      roleArn: executionRoleArn,
      type: 'STANDARD', // or 'EXPRESS' for Express workflows
    });

    const response = await sfnClient.send(command);

    return NextResponse.json({
      success: true,
      stateMachineArn: response.stateMachineArn,
      creationDate: response.creationDate,
      message: 'State machine created successfully!',
    });
  } catch (error) {
    console.error('Error creating state machine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to create state machine',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

