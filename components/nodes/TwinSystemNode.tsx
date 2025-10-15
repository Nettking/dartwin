export interface TwinSystemNodeData {
  label: string;
}

export function TwinSystemNode({ data }: { data: TwinSystemNodeData }) {
  return (
    <div className="node twinsystem">
      <span className="tw-prefix">twin.system</span>
      <em className="tw-name">{data.label}</em>
    </div>
  );
}
