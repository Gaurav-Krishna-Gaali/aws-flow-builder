import { Handle, Position } from 'reactflow';

interface PassStateNodeData {
  label: string;
  result?: string;
  resultPath?: string;
}

interface PassStateNodeProps {
  data: PassStateNodeData;
  selected?: boolean;
}

export default function PassStateNode({ data, selected }: PassStateNodeProps) {
  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <div className="font-semibold text-gray-800">{data.label || 'Pass State'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}


