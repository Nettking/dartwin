export interface PortNodeData {
  label: string;
  caption?: string;
  captionSide?: "bottom" | "right" | "left" | "top";
}

export function PortNode({ data }: { data: PortNodeData }) {
  const captionSide = data.captionSide || "bottom";
  return (
    <div className={`port-node caption-${captionSide}`}>
      <div className="node port" title={data.label}></div>
      {data.caption ? <div className="port-caption">{data.caption}</div> : null}
    </div>
  );
}
