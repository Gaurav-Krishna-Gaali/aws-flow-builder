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
} from 'reactflow';

const initialNodes: Node[] = [
//   {
//     id: '1',
//     type: 'input',
//     data: { label: 'Start Node' },
//     position: { x: 250, y: 100 },
//   },
//   {
//     id: '2',
//     data: { label: 'Process Node' },
//     position: { x: 250, y: 200 },
//   },
//   {
//     id: '3',
//     type: 'output',
//     data: { label: 'End Node' },
//     position: { x: 250, y: 300 },
//   },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

let nodeId = 4;

export default function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = useCallback(() => {
    const newNode: Node = {
      id: `${nodeId}`,
      data: { label: `Node ${nodeId}` },
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

  return (
    <div className="h-screen w-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-gray-50"
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-4 m-4">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Flow Builder</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={addNode}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Add Node
            </button>
            <button
              onClick={deleteSelectedNodes}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Delete Selected
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
