import { Node, Edge } from 'reactflow';

export interface ASLState {
  Type: string;
  [key: string]: any;
}

export interface ASLDefinition {
  Comment?: string;
  StartAt: string;
  States: Record<string, ASLState>;
}

/**
 * Converts React Flow nodes and edges to Amazon States Language (ASL) JSON
 */
export function convertToASL(nodes: Node[], edges: Edge[]): ASLDefinition | null {
  if (nodes.length === 0) {
    return null;
  }

  // Find the start node (first node or node with no incoming edges)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  const startNode = nodes.find((n) => !nodesWithIncoming.has(n.id)) || nodes[0];

  if (!startNode) {
    return null;
  }

  const states: Record<string, ASLState> = {};
  const stateMap = new Map<string, string>(); // nodeId -> stateName

  // Create states from nodes
  nodes.forEach((node) => {
    const stateName = `State_${node.id}`;
    stateMap.set(node.id, stateName);

    if (node.type === 'pass' || node.data?.stateType === 'Pass') {
      // Pass State - simplest Step Functions state
      states[stateName] = {
        Type: 'Pass',
        Comment: node.data?.label || `Pass state ${node.id}`,
        Result: node.data?.result || node.data?.label || 'Pass',
        End: true, // Default to end state, will be updated if has outgoing edges
      };
    } else {
      // Default to Pass state for unknown types
      states[stateName] = {
        Type: 'Pass',
        Comment: node.data?.label || `State ${node.id}`,
        Result: node.data?.label || 'Pass',
        End: true,
      };
    }
  });

  // Update states with Next transitions based on edges
  edges.forEach((edge) => {
    const sourceStateName = stateMap.get(edge.source);
    const targetStateName = stateMap.get(edge.target);

    if (sourceStateName && targetStateName && states[sourceStateName]) {
      // Remove End flag and add Next
      delete states[sourceStateName].End;
      states[sourceStateName].Next = targetStateName;
    }
  });

  // Mark the last node(s) as End states (nodes with no outgoing edges)
  const nodesWithOutgoing = new Set(edges.map((e) => e.source));
  nodes.forEach((node) => {
    if (!nodesWithOutgoing.has(node.id)) {
      const stateName = stateMap.get(node.id);
      if (stateName && states[stateName]) {
        delete states[stateName].Next;
        states[stateName].End = true;
      }
    }
  });

  return {
    Comment: 'State machine generated from Flow Builder',
    StartAt: stateMap.get(startNode.id) || `State_${startNode.id}`,
    States: states,
  };
}

