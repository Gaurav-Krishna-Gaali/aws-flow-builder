import { Node, Edge } from 'reactflow';

export interface ASLState {
  Type: string;
  Comment?: string;
  Next?: string;
  End?: boolean;
  Resource?: string;
  Parameters?: Record<string, unknown>;
  Result?: unknown;
  Choices?: Array<{ Next?: string; Variable?: string }>;
  Default?: string;
  [key: string]: unknown;
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

/**
 * Converts Amazon States Language (ASL) JSON back to React Flow nodes and edges
 */
export function convertFromASL(aslDefinition: ASLDefinition): { nodes: Node[]; edges: Edge[] } | null {
  if (!aslDefinition || !aslDefinition.States || !aslDefinition.StartAt) {
    return null;
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const stateToNodeId = new Map<string, string>();
  let nodeCounter = 1;

  // Create nodes from ASL states
  const stateEntries = Object.entries(aslDefinition.States);
  stateEntries.forEach(([stateName, state], index) => {
    const nodeId = `node-${nodeCounter++}`;
    stateToNodeId.set(stateName, nodeId);

    // Determine position (simple grid layout)
    const cols = Math.ceil(Math.sqrt(stateEntries.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = col * 300 + 100;
    const y = row * 200 + 100;

    // Extract state information
    const stateType = state.Type || 'Pass';
    const comment = (state as { Comment?: string }).Comment || stateName;
    const resource = (state as { Resource?: string }).Resource;
    const parameters = (state as { Parameters?: Record<string, unknown> }).Parameters;
    const result = (state as { Result?: unknown }).Result;

    const node: Node = {
      id: nodeId,
      type: 'pass', // Use pass node type for all states for now
      data: {
        label: comment,
        stateType: stateType,
        stateName: stateName,
        resource: resource,
        parameters: parameters,
        result: result,
        // Store full state for potential editing
        fullState: state,
      },
      position: { x, y },
    };

    nodes.push(node);
  });

  // Create edges from Next transitions
  Object.entries(aslDefinition.States).forEach(([stateName, state]) => {
    const sourceNodeId = stateToNodeId.get(stateName);
    if (!sourceNodeId) return;

    // Handle Next transition
    const nextState = (state as { Next?: string }).Next;
    if (nextState) {
      const targetNodeId = stateToNodeId.get(nextState);
      if (targetNodeId) {
        edges.push({
          id: `edge-${sourceNodeId}-${targetNodeId}`,
          source: sourceNodeId,
          target: targetNodeId,
        });
      }
    }

    // Handle Choices (conditional branches)
    if (state.Type === 'Choice') {
      const choiceState = state as unknown as { Choices?: Array<{ Next?: string; Variable?: string }>; Default?: string };
      if (choiceState.Choices) {
        choiceState.Choices.forEach((choice, index) => {
          if (choice.Next) {
            const targetNodeId = stateToNodeId.get(choice.Next);
            if (targetNodeId) {
              edges.push({
                id: `edge-${sourceNodeId}-${targetNodeId}-${index}`,
                source: sourceNodeId,
                target: targetNodeId,
                label: choice.Variable || `Choice ${index + 1}`,
              });
            }
          }
        });
      }
      // Default choice
      if (choiceState.Default) {
        const defaultNodeId = stateToNodeId.get(choiceState.Default);
        if (defaultNodeId) {
          edges.push({
            id: `edge-${sourceNodeId}-${defaultNodeId}-default`,
            source: sourceNodeId,
            target: defaultNodeId,
            label: 'Default',
          });
        }
      }
    }
  });

  return { nodes, edges };
}


