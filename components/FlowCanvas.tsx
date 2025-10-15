import { useMemo, useEffect } from "react";
import { ReactFlow, useReactFlow } from "reactflow";
import type { Edge, Node } from "reactflow";
import { DigitalTwinNode, GoalTrapezoid, PortNode, TwinSystemNode } from "./nodes";

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
}

export function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect }: FlowCanvasProps) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.1 }), 0);
    return () => clearTimeout(t);
  }, [nodes, fitView]);

  const nodeTypes = useMemo(
    () => ({
      port: PortNode,
      goal: GoalTrapezoid,
      dt: DigitalTwinNode,
      twinsystem: TwinSystemNode,
    }),
    []
  );

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
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      panOnScroll
      style={{ background: "#fff" }}
      fitView
      fitViewOptions={{ padding: 0.15 }}
    />
  );
}
