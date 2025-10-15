import { ReactFlow } from "reactflow";
import type { Connection, Edge, Node, OnEdgesChange, OnNodesChange } from "reactflow";

import { nodeTypes } from "./NodeTypes";

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: DiagramCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: "straight" }}
      nodesDraggable
      nodesConnectable
      fitView={false}
      panOnDrag={false}
      panOnScroll
      zoomOnScroll={false}
      selectionOnDrag
      style={{ background: "#fff" }}
    />
  );
}
