import { Handle, Position } from 'reactflow';

interface PassStateNodeData {
  label: string;
  result?: string;
  resultPath?: string;
  stateType?: string;
  stateName?: string;
  resource?: string;
  parameters?: Record<string, unknown>;
  fullState?: Record<string, unknown>;
}

interface PassStateNodeProps {
  data: PassStateNodeData;
  selected?: boolean;
}

export default function PassStateNode({ data, selected }: PassStateNodeProps) {
  const stateType = data.stateType || 'Pass';
  
  // Determine color based on state type
  const getStateColor = () => {
    switch (stateType) {
      case 'Task':
        return 'bg-blue-500';
      case 'Choice':
        return 'bg-purple-500';
      case 'Wait':
        return 'bg-yellow-500';
      case 'Succeed':
        return 'bg-green-500';
      case 'Fail':
        return 'bg-red-500';
      case 'Parallel':
        return 'bg-indigo-500';
      case 'Map':
        return 'bg-pink-500';
      default:
        return 'bg-green-500'; // Pass state
    }
  };

  const getStateLabel = () => {
    if (data.stateName) {
      return `${data.stateName} (${stateType})`;
    }
    return data.label || `${stateType} State`;
  };

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${getStateColor()}`}></div>
        <div className="font-semibold text-gray-800 text-sm">{getStateLabel()}</div>
      </div>
      {data.resource && (
        <div className="mt-1 text-xs text-gray-600 font-mono truncate max-w-[200px]" title={data.resource}>
          {data.resource}
        </div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}


