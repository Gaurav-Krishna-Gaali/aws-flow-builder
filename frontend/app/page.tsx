'use client';

import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  NodeTypes,
} from 'reactflow';
import PassStateNode from './components/PassStateNode';
import { convertToASL } from './utils/aslConverter';

const nodeTypes: NodeTypes = {
  pass: PassStateNode,
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

let nodeId = 1;

export default function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [aslJson, setAslJson] = useState<string>('');
  const [showAsl, setShowAsl] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; arn?: string } | null>(null);
  const [stateMachineArn, setStateMachineArn] = useState<string | null>(null);
  
  // Execution states
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionInput, setExecutionInput] = useState<string>('{}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<{
    executionArn: string;
    status: string;
    input: unknown;
    output?: unknown;
    error?: string;
    cause?: string;
    startDate: Date;
    stopDate?: Date;
  } | null>(null);
  const [executionHistory, setExecutionHistory] = useState<Array<{
    executionArn: string;
    name?: string;
    status: string;
    startDate: Date;
  }>>([]);
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addPassState = useCallback(() => {
    const newNode: Node = {
      id: `node-${nodeId}`,
      type: 'pass',
      data: { 
        label: `Pass State ${nodeId}`,
        stateType: 'Pass',
      },
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    nodeId++;
  }, [setNodes]);

  const deleteSelectedNodes = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !nodes.find((n) => n.selected && (n.id === edge.source || n.id === edge.target))
      )
    );
  }, [nodes, setNodes, setEdges]);

  const exportToASL = useCallback(() => {
    const asl = convertToASL(nodes, edges);
    if (asl) {
      setAslJson(JSON.stringify(asl, null, 2));
      setShowAsl(true);
    } else {
      alert('Cannot export: No nodes in the flow');
    }
  }, [nodes, edges]);

  const deployToAWS = useCallback(async () => {
    const asl = convertToASL(nodes, edges);
    if (!asl) {
      alert('Cannot deploy: No nodes in the flow');
      return;
    }

    const stateMachineName = prompt('Enter a name for your state machine:', `flow-builder-${Date.now()}`);
    if (!stateMachineName) return;

    setIsDeploying(true);
    setDeployResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/state-machines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: stateMachineName,
          definition: asl,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const arn = result.stateMachineArn;
        setStateMachineArn(arn);
        setDeployResult({
          success: true,
          message: result.message || 'State machine created successfully!',
          arn: arn,
        });
      } else {
        setDeployResult({
          success: false,
          message: result.error || result.details || 'Failed to create state machine',
        });
      }
    } catch (error) {
      setDeployResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error occurred',
      });
    } finally {
      setIsDeploying(false);
    }
  }, [nodes, edges]);

  const loadExecutionHistory = useCallback(async () => {
    if (!stateMachineArn) return;

    try {
      const response = await fetch(`${API_BASE_URL}/executions?stateMachineArn=${encodeURIComponent(stateMachineArn)}&maxResults=10`);
      const result = await response.json();

      if (response.ok) {
        setExecutionHistory(result.executions || []);
      }
    } catch (error) {
      console.error('Error loading execution history:', error);
    }
  }, [stateMachineArn]);

  const pollExecutionStatus = useCallback(async (executionArn: string) => {
    const maxAttempts = 60; // Poll for up to 60 seconds
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`);
        const result = await response.json();

        if (response.ok) {
          setCurrentExecution(result);
          
          // If execution is still running, continue polling
          if (result.status === 'RUNNING' && attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 1000); // Poll every second
          } else {
            // Execution finished or failed, refresh history
            loadExecutionHistory();
          }
        }
      } catch (error) {
        console.error('Error polling execution:', error);
      }
    };

    poll();
  }, [loadExecutionHistory]);

  const startExecution = useCallback(async () => {
    if (!stateMachineArn) {
      alert('Please deploy the state machine first');
      return;
    }

    let input;
    try {
      input = JSON.parse(executionInput);
    } catch {
      alert('Invalid JSON input. Please enter valid JSON.');
      return;
    }

    setIsExecuting(true);
    setCurrentExecution(null);

    try {
      const response = await fetch(`${API_BASE_URL}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stateMachineArn: stateMachineArn,
          input: input,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Start polling for execution status
        pollExecutionStatus(result.executionArn);
        setShowExecutionModal(false);
      } else {
        alert(`Failed to start execution: ${result.error || result.details}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Network error occurred'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [stateMachineArn, executionInput, pollExecutionStatus]);

  const viewExecutionDetails = useCallback(async (executionArn: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/executions/${encodeURIComponent(executionArn)}`);
      const result = await response.json();

      if (response.ok) {
        setCurrentExecution(result);
        setShowExecutionDetails(true);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to load execution details'}`);
    }
  }, []);

  const deleteWorkflow = useCallback(async () => {
    if (!stateMachineArn) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this workflow? This action cannot be undone and will delete the state machine from AWS.'
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/state-machines?stateMachineArn=${encodeURIComponent(stateMachineArn)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        // Clear all state related to the deleted workflow
        setStateMachineArn(null);
        setExecutionHistory([]);
        setCurrentExecution(null);
        setDeployResult({
          success: true,
          message: result.message || 'Workflow deleted successfully!',
        });
      } else {
        setDeployResult({
          success: false,
          message: result.error || result.details || 'Failed to delete workflow',
        });
      }
    } catch (error) {
      setDeployResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error occurred',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [stateMachineArn]);

  // Load execution history when state machine is deployed
  useEffect(() => {
    if (stateMachineArn) {
      loadExecutionHistory();
      // Refresh history every 5 seconds
      const interval = setInterval(loadExecutionHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [stateMachineArn, loadExecutionHistory]);

  return (
    <div className="h-screen w-screen relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-4 m-4 max-w-xs">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Step Functions Builder</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={addPassState}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
            >
              + Add Pass State
            </button>
            <button
              onClick={deleteSelectedNodes}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
            >
              Delete Selected
            </button>
            <button
              onClick={exportToASL}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm mt-2"
            >
              Export to ASL
            </button>
            <button
              onClick={deployToAWS}
              disabled={isDeploying}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? 'Deploying...' : 'Deploy to AWS'}
            </button>
            {stateMachineArn && (
              <>
                <button
                  onClick={() => setShowExecutionModal(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-sm mt-2"
                >
                  Start Execution
                </button>
                <button
                  onClick={loadExecutionHistory}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors text-sm"
                >
                  View History
                </button>
              </>
            )}
          </div>
          {stateMachineArn && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2">Deployed State Machine:</p>
              <code className="text-xs text-gray-800 break-all bg-gray-100 p-2 rounded block mb-2">
                {stateMachineArn.split('/').pop()}
              </code>
              <button
                onClick={deleteWorkflow}
                disabled={isDeleting}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workflow'}
              </button>
            </div>
          )}
        </Panel>
        
        {/* Execution History Panel */}
        {stateMachineArn && executionHistory.length > 0 && (
          <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-4 m-4 max-w-sm max-h-[60vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">Execution History</h3>
              <button
                onClick={() => setExecutionHistory([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {executionHistory.map((execution) => (
                <div
                  key={execution.executionArn}
                  className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => viewExecutionDetails(execution.executionArn)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-600">
                      {execution.name || execution.executionArn.split(':').pop()?.substring(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        execution.status === 'SUCCEEDED'
                          ? 'bg-green-100 text-green-700'
                          : execution.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : execution.status === 'RUNNING'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {execution.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(execution.startDate).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Current Execution Status (if running) */}
        {currentExecution && currentExecution.status === 'RUNNING' && (
          <Panel position="bottom-right" className="bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 m-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-800">Execution running...</span>
              <button
                onClick={() => viewExecutionDetails(currentExecution.executionArn)}
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
              >
                View Details
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {showAsl && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl max-h-[80vh] overflow-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Amazon States Language (ASL) JSON</h3>
              <button
                onClick={() => setShowAsl(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              <code className='text-black'>{aslJson}</code>
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aslJson);
                  alert('ASL JSON copied to clipboard!');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowAsl(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deployResult && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-bold ${deployResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {deployResult.success ? '✓ Deployment Successful' : '✗ Deployment Failed'}
              </h3>
              <button
                onClick={() => setDeployResult(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <p className="text-gray-700 mb-4">{deployResult.message}</p>
            {deployResult.arn && (
              <div className="bg-gray-100 p-3 rounded mb-4">
                <p className="text-xs text-gray-600 mb-1">State Machine ARN:</p>
                <code className="text-xs text-gray-800 break-all">{deployResult.arn}</code>
              </div>
            )}
            <button
              onClick={() => setDeployResult(null)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Start Execution Modal */}
      {showExecutionModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Start Execution</h3>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input (JSON):
              </label>
              <textarea
                value={executionInput}
                onChange={(e) => setExecutionInput(e.target.value)}
                className="w-full h-32 p-2 border border-gray-300 rounded font-mono text-sm"
                placeholder='{"key": "value"}'
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={startExecution}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isExecuting ? 'Starting...' : 'Start'}
              </button>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      {showExecutionDetails && currentExecution && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl max-h-[80vh] overflow-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Execution Details</h3>
              <button
                onClick={() => {
                  setShowExecutionDetails(false);
                  setCurrentExecution(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Status</h4>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm ${
                    currentExecution.status === 'SUCCEEDED'
                      ? 'bg-green-100 text-green-700'
                      : currentExecution.status === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : currentExecution.status === 'RUNNING'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {currentExecution.status}
                </span>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Input</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                  <code className="text-black">
                    {JSON.stringify(currentExecution.input, null, 2) as string}
                  </code>
                </pre>
              </div>

              {currentExecution.output !== null && currentExecution.output !== undefined && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Output</h4>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                    <code className="text-black">
                      {JSON.stringify(currentExecution.output, null, 2) as string}
                    </code>
                  </pre>
                </div>
              )}

              {currentExecution.error && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Error</h4>
                  <pre className="bg-red-50 p-3 rounded text-sm overflow-auto border border-red-200">
                    <code className="text-red-800">
                      {currentExecution.error}
                    </code>
                  </pre>
                  {currentExecution.cause && (
                    <pre className="bg-red-50 p-3 rounded text-sm overflow-auto border border-red-200 mt-2">
                      <code className="text-red-800">
                        {currentExecution.cause}
                      </code>
                    </pre>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Start Date:</span>
                  <p className="text-gray-800">
                    {new Date(currentExecution.startDate).toLocaleString()}
                  </p>
                </div>
                {currentExecution.stopDate && (
                  <div>
                    <span className="text-gray-600">Stop Date:</span>
                    <p className="text-gray-800">
                      {new Date(currentExecution.stopDate).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Execution ARN</h4>
                <code className="text-xs text-gray-600 bg-gray-100 p-2 rounded block break-all">
                  {currentExecution.executionArn}
                </code>
              </div>
            </div>

            <button
              onClick={() => {
                setShowExecutionDetails(false);
                setCurrentExecution(null);
              }}
              className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
