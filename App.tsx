import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import type { Edge, Node } from "reactflow";
import Editor from "@monaco-editor/react";
import { DarTwinFrame } from "./components/DarTwinFrame";
import { FlowCanvas } from "./components/FlowCanvas";
import { parseDarTwin } from "./parser";
import { layoutDarTwin } from "./layout";
import { formatLabel } from "./utils/format";
import "./App.css";
import "reactflow/dist/style.css";

const sample = `#dartwin StrawberryCultivationTrans {
  #twinsystem Strawberry {
    connect Strawberry.Cultivation.MultiSensor        to StrawberryDT.multisensor_input;
    connect StrawberryDT.actuator_output_irrigation   to Strawberry.Cultivation.IrrigationActuator;
    connect StrawberryDT.actuator_output_human        to Strawberry.Cultivation.HumanActuator;
    connect StrawberryDT.actuator_output_ventilation  to Strawberry.Cultivation.VentilationActuator;

    #digitaltwin StrawberryDT {
      port multisensor_input;
      port actuator_output_irrigation;
      port actuator_output_human;
      port actuator_output_ventilation;
    }

    part Cultivation {
      port MultiSensor;
      port IrrigationActuator;
      port HumanActuator;
      port VentilationActuator;
    }
  }

  #goal increase_yield { doc /* yield y higher y than before */ }
  #goal apply_decreased_water { doc /* water consumption w lower w than before */ }

  allocate increase_yield to Strawberry.StrawberryDT;
  allocate apply_decreased_water to Strawberry.StrawberryDT;
}`;

function useLayout(nodes: Node[], edges: Edge[]) {
  const [stateNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [stateEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  return { nodes: stateNodes, edges: stateEdges, setEdges, onNodesChange, onEdgesChange };
}

function InnerApp() {
  const [text, setText] = useState(sample);
  const parsed = useMemo(() => parseDarTwin(text), [text]);
  const dartwinTitle = useMemo(() => {
    const dartwinNode = parsed.nodes.find((n) => n.type === "dartwin");
    return formatLabel(dartwinNode?.label ?? "");
  }, [parsed.nodes]);

  const layout = useMemo(() => layoutDarTwin(parsed.nodes, parsed.edges), [parsed.nodes, parsed.edges]);
  const { nodes, edges, setEdges, onNodesChange, onEdgesChange } = useLayout(layout.nodes, layout.edges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="app-container">
      <div className="panel">
        <h2>DarTwin Text</h2>
        <Editor
          height="75vh"
          defaultLanguage="plaintext"
          value={text}
          onChange={(value) => setText(value || "")}
        />
      </div>

      <div className="panel">
        <h2>Diagram</h2>
        <DarTwinFrame title={dartwinTitle}>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          />
        </DarTwinFrame>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <InnerApp />
    </ReactFlowProvider>
  );
}
