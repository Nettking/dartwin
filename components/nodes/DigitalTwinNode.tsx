export interface DigitalTwinNodeData {
  label: string;
}

export function DigitalTwinNode({ data }: { data: DigitalTwinNodeData }) {
  return (
    <div className="node dt">
      <span className="dt-name">{data.label}</span>
    </div>
  );
}
