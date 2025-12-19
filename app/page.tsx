'use client';

import { useCallback, useState } from 'react';
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
      const response = await fetch('/api/create-state-machine', {
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
        setDeployResult({
          success: true,
          message: result.message || 'State machine created successfully!',
          arn: result.stateMachineArn,
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
          </div>
        </Panel>
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
    </div>
  );
}
