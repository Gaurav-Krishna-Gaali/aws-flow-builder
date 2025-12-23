'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
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
import { convertToASL, convertFromASL, ASLDefinition } from './utils/aslConverter';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importAslText, setImportAslText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedASL, setImportedASL] = useState<ASLDefinition | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      // Clear imported ASL if user manually connects nodes (they're editing)
      if (importedASL) {
        setImportedASL(null);
      }
    },
    [setEdges, importedASL]
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
    // Clear imported ASL if user adds new nodes (they're editing)
    if (importedASL) {
      setImportedASL(null);
    }
  }, [setNodes, importedASL]);

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
    // Use imported ASL if available, otherwise convert from nodes
    const asl = importedASL || convertToASL(nodes, edges);
    if (asl) {
      setAslJson(JSON.stringify(asl, null, 2));
      setShowAsl(true);
    } else {
      alert('Cannot export: No nodes in the flow');
    }
  }, [nodes, edges, importedASL]);

  const handleImportASL = useCallback(() => {
    setShowImportModal(true);
    setImportAslText('');
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportAslText(content);
    };
    reader.readAsText(file);
  }, []);

  const confirmImportASL = useCallback(() => {
    if (!importAslText.trim()) {
      alert('Please paste or upload ASL JSON');
      return;
    }

    setIsImporting(true);
    try {
      const aslJson = JSON.parse(importAslText) as ASLDefinition;
      
      // Validate ASL structure
      if (!aslJson.States || !aslJson.StartAt) {
        alert('Failed to import: Invalid ASL structure. Missing States or StartAt.');
        setIsImporting(false);
        return;
      }

      // Store the original ASL for deployment
      setImportedASL(aslJson);
      
      // Convert to nodes/edges for visual representation
      const result = convertFromASL(aslJson);
      
      if (result && result.nodes.length > 0) {
        // Update nodes and edges
        setNodes(result.nodes);
        setEdges(result.edges);
        
        // Reset node counter to avoid conflicts
        nodeId = result.nodes.length + 1;
        
        setShowImportModal(false);
        setImportAslText('');
        alert(`Successfully imported ${result.nodes.length} states! The original ASL structure is preserved for deployment.`);
      } else {
        alert('Failed to import: Could not convert ASL to visual representation');
        setImportedASL(null);
      }
    } catch (error) {
      console.error('Error importing ASL:', error);
      alert('Failed to import: Invalid JSON format');
      setImportedASL(null);
    } finally {
      setIsImporting(false);
    }
  }, [importAslText, setNodes, setEdges]);

  const deployToAWS = useCallback(async () => {
    // Use imported ASL if available, otherwise convert from nodes
    const asl = importedASL || convertToASL(nodes, edges);
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
  }, [nodes, edges, importedASL]);

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
    <div className="h-screen w-screen relative bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-900"
      >
        <Controls className="bg-gray-800 border-gray-700" />
        <MiniMap 
          className="bg-gray-800 border-gray-700"
          maskColor="rgba(17, 24, 39, 0.8)"
          nodeColor={(node) => {
            if (node.selected) return '#6366f1'; // indigo-500
            return '#374151'; // gray-700
          }}
        />
        <Background gap={12} size={1} color="#374151" />
        <Panel position="top-left" className="bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 p-4 m-4 max-w-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Step Functions Builder</h2>
            <Link
              href="/dashboard"
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Dashboard →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={addPassState}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors text-sm shadow-lg shadow-green-500/20"
            >
              + Add Pass State
            </button>
            <button
              onClick={deleteSelectedNodes}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors text-sm shadow-lg shadow-red-500/20"
            >
              Delete Selected
            </button>
            <button
              onClick={handleImportASL}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 transition-colors text-sm mt-2 shadow-lg shadow-cyan-500/20"
            >
              Import ASL
            </button>
            <button
              onClick={exportToASL}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors text-sm shadow-lg shadow-blue-500/20"
            >
              Export to ASL
            </button>
            <button
              onClick={deployToAWS}
              disabled={isDeploying}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
            >
              {isDeploying ? 'Deploying...' : 'Deploy to AWS'}
            </button>
            {stateMachineArn && (
              <>
                <button
                  onClick={() => setShowExecutionModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors text-sm mt-2 shadow-lg shadow-orange-500/20"
                >
                  Start Execution
                </button>
                <button
                  onClick={loadExecutionHistory}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors text-sm shadow-lg shadow-indigo-500/20"
                >
                  View History
                </button>
              </>
            )}
          </div>
          {stateMachineArn && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-2">Deployed State Machine:</p>
              <code className="text-xs text-gray-300 break-all bg-gray-900/50 border border-gray-700 p-2 rounded block mb-2">
                {stateMachineArn.split('/').pop()}
              </code>
              <button
                onClick={deleteWorkflow}
                disabled={isDeleting}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workflow'}
              </button>
            </div>
          )}
        </Panel>
        
        {/* Execution History Panel */}
        {stateMachineArn && executionHistory.length > 0 && (
          <Panel position="top-right" className="bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 p-4 m-4 max-w-sm max-h-[60vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-white">Execution History</h3>
              <button
                onClick={() => setExecutionHistory([])}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {executionHistory.map((execution) => (
                <div
                  key={execution.executionArn}
                  className="p-2 border border-gray-700 rounded cursor-pointer hover:bg-gray-900/50 transition-colors"
                  onClick={() => viewExecutionDetails(execution.executionArn)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-300">
                      {execution.name || execution.executionArn.split(':').pop()?.substring(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        execution.status === 'SUCCEEDED'
                          ? 'bg-green-500/20 text-green-400'
                          : execution.status === 'FAILED'
                          ? 'bg-red-500/20 text-red-400'
                          : execution.status === 'RUNNING'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
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
          <Panel position="bottom-right" className="bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-lg shadow-lg p-3 m-4">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-300">Execution running...</span>
              <button
                onClick={() => viewExecutionDetails(currentExecution.executionArn)}
                className="text-xs text-blue-400 hover:text-blue-300 underline ml-2 transition-colors"
              >
                View Details
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {showAsl && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-2xl max-h-[80vh] overflow-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Amazon States Language (ASL) JSON</h3>
              <button
                onClick={() => setShowAsl(false)}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            <pre className="bg-gray-900/50 border border-gray-700 p-4 rounded overflow-auto text-sm">
              <code className='text-gray-300'>{aslJson}</code>
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aslJson);
                  alert('ASL JSON copied to clipboard!');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowAsl(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deployResult && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-bold ${deployResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {deployResult.success ? '✓ Deployment Successful' : '✗ Deployment Failed'}
              </h3>
              <button
                onClick={() => setDeployResult(null)}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            <p className="text-gray-300 mb-4">{deployResult.message}</p>
            {deployResult.arn && (
              <div className="bg-gray-900/50 border border-gray-700 p-3 rounded mb-4">
                <p className="text-xs text-gray-400 mb-1">State Machine ARN:</p>
                <code className="text-xs text-gray-300 break-all">{deployResult.arn}</code>
              </div>
            )}
            <button
              onClick={() => setDeployResult(null)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Start Execution Modal */}
      {showExecutionModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Start Execution</h3>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Input (JSON):
              </label>
              <textarea
                value={executionInput}
                onChange={(e) => setExecutionInput(e.target.value)}
                className="w-full h-32 p-2 bg-gray-900/50 border border-gray-700 rounded font-mono text-sm text-white placeholder-gray-500"
                placeholder='{"key": "value"}'
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={startExecution}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20"
              >
                {isExecuting ? 'Starting...' : 'Start'}
              </button>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      {showExecutionDetails && currentExecution && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-3xl max-h-[80vh] overflow-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Execution Details</h3>
              <button
                onClick={() => {
                  setShowExecutionDetails(false);
                  setCurrentExecution(null);
                }}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Status</h4>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm ${
                    currentExecution.status === 'SUCCEEDED'
                      ? 'bg-green-500/20 text-green-400'
                      : currentExecution.status === 'FAILED'
                      ? 'bg-red-500/20 text-red-400'
                      : currentExecution.status === 'RUNNING'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {currentExecution.status}
                </span>
              </div>

              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Input</h4>
                <pre className="bg-gray-900/50 border border-gray-700 p-3 rounded text-sm overflow-auto">
                  <code className="text-gray-300">
                    {JSON.stringify(currentExecution.input, null, 2) as string}
                  </code>
                </pre>
              </div>

              {currentExecution.output !== null && currentExecution.output !== undefined && (
                <div>
                  <h4 className="font-semibold text-gray-300 mb-2">Output</h4>
                  <pre className="bg-gray-900/50 border border-gray-700 p-3 rounded text-sm overflow-auto">
                    <code className="text-gray-300">
                      {JSON.stringify(currentExecution.output, null, 2) as string}
                    </code>
                  </pre>
                </div>
              )}

              {currentExecution.error && (
                <div>
                  <h4 className="font-semibold text-red-400 mb-2">Error</h4>
                  <pre className="bg-red-500/10 border border-red-500/30 p-3 rounded text-sm overflow-auto">
                    <code className="text-red-400">
                      {currentExecution.error}
                    </code>
                  </pre>
                  {currentExecution.cause && (
                    <pre className="bg-red-500/10 border border-red-500/30 p-3 rounded text-sm overflow-auto mt-2">
                      <code className="text-red-400">
                        {currentExecution.cause}
                      </code>
                    </pre>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Start Date:</span>
                  <p className="text-white">
                    {new Date(currentExecution.startDate).toLocaleString()}
                  </p>
                </div>
                {currentExecution.stopDate && (
                  <div>
                    <span className="text-gray-400">Stop Date:</span>
                    <p className="text-white">
                      {new Date(currentExecution.stopDate).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-gray-300 mb-2">Execution ARN</h4>
                <code className="text-xs text-gray-400 bg-gray-900/50 border border-gray-700 p-2 rounded block break-all">
                  {currentExecution.executionArn}
                </code>
              </div>
            </div>

            <button
              onClick={() => {
                setShowExecutionDetails(false);
                setCurrentExecution(null);
              }}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Import ASL Modal */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Import ASL JSON</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportAslText('');
                }}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload JSON File:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-gray-400">OR</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Paste ASL JSON:
                </label>
                <textarea
                  value={importAslText}
                  onChange={(e) => setImportAslText(e.target.value)}
                  className="w-full h-64 p-3 bg-gray-900/50 border border-gray-700 rounded font-mono text-sm text-white placeholder-gray-500 resize-none"
                  placeholder='{\n  "Comment": "My workflow",\n  "StartAt": "State_1",\n  "States": {\n    "State_1": {\n      "Type": "Pass",\n      "Result": "Hello",\n      "End": true\n    }\n  }\n}'
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={confirmImportASL}
                  disabled={isImporting || !importAslText.trim()}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportAslText('');
                  }}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
