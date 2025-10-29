import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import Editor from "@monaco-editor/react";

import { DarTwinFrame } from "./components/DarTwinFrame";
import { DiagramCanvas } from "./components/DiagramCanvas";
import { parseDarTwin } from "./parser/parseDarTwin";
import { darTwinToReactFlow } from "./adapters/darTwinToReactFlow";
import { computeLayout } from "./layout/computeLayout";
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

function useLayout(initialNodes: Node[], initialEdges: Edge[]) {
  const [stateNodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [stateEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const layoutSignature = useMemo(
    () => initialNodes.map((node) => node.id).join("|"),
    [initialNodes]
  );

  useEffect(() => {
    setNodes([]);
  }, [layoutSignature, setNodes]);

  useEffect(() => {
    setNodes((prev) => (prev.length === 0 ? initialNodes : prev));
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  return { nodes: stateNodes, edges: stateEdges, setEdges, onNodesChange, onEdgesChange };
}

function InnerApp() {
  const [text, setText] = useState(sample);
  const model = useMemo(() => parseDarTwin(text), [text]);
  const dartwinTitle = useMemo(() => formatLabel(model.name ?? ""), [model.name]);
  const graph = useMemo(() => darTwinToReactFlow(model), [model]);
  const layout = useMemo(() => computeLayout(graph), [graph]);
  const { nodes, edges, setEdges, onNodesChange, onEdgesChange } = useLayout(
    layout.nodes,
    layout.edges
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
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
          options={{ minimap: { enabled: false } }}
        />
      </div>

      <div className="panel">
        <h2>Diagram</h2>
        <DarTwinFrame title={dartwinTitle}>
          <DiagramCanvas
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
