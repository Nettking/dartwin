import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ReactFlowProvider,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";

import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import Editor from "@monaco-editor/react";
import "./App.css";

/* ============================================================================
   Types
============================================================================ */
type DTNode = {
  id: string;
  type: "dartwin" | "twinsystem" | "dt" | "port" | "goal";
  label: string;
  parentId?: string;
  doc?: string;
};

type DTEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

/* ============================================================================
   Example DSL
============================================================================ */
const sample = `#dartwin StrawberryCultivation {
  #twinsystem StrawberryController  {
    connect StrawberryCultivation.CultivationSystem.FieldMultisensor  to StrawberryDT.multisensor_input;
    connect StrawberryCultivation.CultivationSystem.FieldSoilMoisture to StrawberryDT.soilMoisture_input;
    connect StrawberryDT.actuator_output_ventilation to StrawberryCultivation.CultivationSystem.FieldActuatorVentilation;
    connect StrawberryDT.actuator_output_irrigation  to StrawberryCultivation.CultivationSystem.FieldActuatorIrrigation;
    connect StrawberryDT.actuator_output_human       to StrawberryCultivation.CultivationSystem.FieldHumanActuator;

    #digitaltwin StrawberryDT {
      port multisensor_input;
      port soilMoisture_input;
      port actuator_output_ventilation;
      port actuator_output_irrigation;
      port actuator_output_human;
    }

    part CultivationSystem {
      port FieldMultisensor;
      port FieldSoilMoisture;
      port FieldActuatorVentilation;
      port FieldActuatorIrrigation;
      port FieldHumanActuator;
    }
  }

  #goal increase_yield { doc /* maximize strawberry yield */ }
  #goal apply_decreased_water { doc /* decreased water */ }

  allocate increase_yield to StrawberryController.StrawberryDT;
  allocate apply_decreased_water to StrawberryController.StrawberryDT;
}`;

/* ============================================================================
   Parser
============================================================================ */
function parseDarTwin(text: string): { nodes: DTNode[]; edges: DTEdge[] } {
  const nodes: DTNode[] = [];
  const edges: DTEdge[] = [];

  const extractBlock = (src: string, openIdx: number) => {
    let depth = 0;
    let i = openIdx;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return { body: src.slice(openIdx + 1, i), end: i };
  };

  const dwHeader = /#dartwin\s+(\w+)\s*\{/;
  const dwMatch = dwHeader.exec(text);
  if (!dwMatch) return { nodes, edges };

  const dartwinLabel = dwMatch[1];
  const dwOpen = text.indexOf("{", dwMatch.index!);
  const { body: dwBody } = extractBlock(text, dwOpen);
  const dwId = `dartwin_${dartwinLabel}`;
  nodes.push({ id: dwId, type: "dartwin", label: dartwinLabel });

  const twinHeader = /#twinsystem\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = twinHeader.exec(dwBody))) {
    const twinName = m[1];
    const open = dwBody.indexOf("{", m.index);
    const { body: twinBody, end } = extractBlock(dwBody, open);
    const twinId = `${dwId}_twinsystem_${twinName}`;
    nodes.push({ id: twinId, type: "twinsystem", label: twinName, parentId: dwId });

    const dtHeader = /#digitaltwin\s+(\w+)\s*\{/g;
    let d: RegExpExecArray | null;
    while ((d = dtHeader.exec(twinBody))) {
      const dtName = d[1];
      const dtOpen = twinBody.indexOf("{", d.index);
      const { body: dtBody } = extractBlock(twinBody, dtOpen);
      const dtId = `${twinId}_dt_${dtName}`;
      nodes.push({ id: dtId, type: "dt", label: dtName, parentId: twinId });

      const dtPorts = /port\s+(\w+)\s*;/g;
      let p: RegExpExecArray | null;
      while ((p = dtPorts.exec(dtBody))) {
        const portName = p[1];
        nodes.push({
          id: `${dtId}_port_${portName}`,
          type: "port",
          label: portName,
          parentId: dtId,
        });
      }
    }

    const partHeader = /part\s+(\w+)\s*\{/g;
    let ph: RegExpExecArray | null;
    while ((ph = partHeader.exec(twinBody))) {
      const partOpen = twinBody.indexOf("{", ph.index);
      const { body: partBody } = extractBlock(twinBody, partOpen);
      const twinPorts = /port\s+(\w+)\s*;/g;
      let tp: RegExpExecArray | null;
      while ((tp = twinPorts.exec(partBody))) {
        const portName = tp[1];
        nodes.push({
          id: `${twinId}_port_${portName}`,
          type: "port",
          label: portName,
          parentId: twinId,
        });
      }
    }

    const conn = /connect\s+([\w\.]+)\s+to\s+([\w\.]+)\s*;/g;
    let c: RegExpExecArray | null;
    while ((c = conn.exec(twinBody))) {
      const left = `${twinId}_${c[1].replace(/\./g, "_")}`;
      const right = `${twinId}_${c[2].replace(/\./g, "_")}`;
      edges.push({ id: `c_${edges.length}`, source: left, target: right });
    }

    twinHeader.lastIndex = m.index + (end - open) + 1;
  }

  const goalHeader = /#goal\s+(\w+)\s*(\{)?/g;
  let g: RegExpExecArray | null;
  while ((g = goalHeader.exec(dwBody))) {
    const goalName = g[1];
    let doc: string | undefined;
    if (g[2] === "{") {
      const open = dwBody.indexOf("{", g.index);
      if (open !== -1) {
        const { body: goalBody, end } = extractBlock(dwBody, open);
        const docMatch = /doc\s*\/\*([\s\S]*?)\*\//.exec(goalBody);
        if (docMatch) {
          doc = docMatch[1].replace(/\s+/g, " ").trim();
        }
        goalHeader.lastIndex = end + 1;
      }
    }

    nodes.push({
      id: `${dwId}_goal_${goalName}`,
      type: "goal",
      label: goalName,
      parentId: dwId,
      doc,
    });
  }

  const alloc = /allocate\s+(\w+)\s+to\s+([\w\.]+)\s*;/g;
  let a: RegExpExecArray | null;
  while ((a = alloc.exec(dwBody))) {
    edges.push({
      id: `alloc_${a[1]}`,
      source: `${dwId}_goal_${a[1]}`,
      target: `${dwId}_${a[2].replace(/\./g, "_")}`,
      label: "allocate",
    });
  }

  return { nodes, edges };
}

/* ============================================================================
   Node Components
============================================================================ */
function PortNode({ data }: any) {
  return <div className="node port" title={data.label}></div>;
}
function GoalNode({ data }: any) {
  return (
    <div className="node goal">
      <div className="goal-title">{data.label}</div>
      {data.doc ? <div className="goal-doc">{data.doc}</div> : null}
    </div>
  );
}
function BoxNode({ data }: any) {
  return <div className={`node ${data.color || ""}`}>{data.label}</div>;
}

/* ============================================================================
   Layout Logic
============================================================================ */
function toRF(nodes: DTNode[], edges: DTEdge[]) {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  const formatLabel = (label: string) =>
    label
      .split(/_|(?=[A-Z])/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const canvasWidth = 640;
  const centerX = canvasWidth / 2;

  const dartwin = nodes.find((n) => n.type === "dartwin");
  const twinsystems = nodes.filter((n) => n.type === "twinsystem");
  const digitalTwins = nodes.filter((n) => n.type === "dt");
  const goalNodes = nodes.filter((n) => n.type === "goal");
  const portNodes = nodes.filter((n) => n.type === "port");

  goalNodes.forEach((goal, idx) => {
    rfNodes.push({
      id: goal.id,
      type: goal.type,
      data: {
        label: formatLabel(goal.label),
        doc: goal.doc,
      },
      position: {
        x: 80 + idx * 240,
        y: 10,
      },
      style: {
        width: 180,
        height: 68,
      },
      draggable: false,
      selectable: false,
    });
  });

  if (dartwin) {
    rfNodes.push({
      id: dartwin.id,
      type: dartwin.type,
      data: { label: `dartwin ${formatLabel(dartwin.label)}` },
      position: { x: 60, y: 120 },
      style: { width: 360, height: 52, alignItems: "center", justifyContent: "flex-start", padding: "0 16px" },
      draggable: false,
      selectable: false,
    });
  }

  twinsystems.forEach((tw, idx) => {
    rfNodes.push({
      id: tw.id,
      type: tw.type,
      data: { label: `twin.system ${formatLabel(tw.label)}` },
      position: { x: 100 + idx * 240, y: 190 },
      style: { width: 320, height: 48, alignItems: "center", justifyContent: "flex-start", padding: "0 16px" },
      draggable: false,
      selectable: false,
    });
  });

  digitalTwins.forEach((dt, index) => {
    const width = 260;
    const height = 140;
    const x = centerX - width / 2 + index * 280;
    const y = 270;

    rfNodes.push({
      id: dt.id,
      type: dt.type,
      data: { label: formatLabel(dt.label) },
      position: { x, y },
      style: { width, height, padding: "12px 16px", alignItems: "flex-start" },
      draggable: false,
      selectable: false,
    });

    const dtPorts = portNodes.filter((p) => p.parentId === dt.id);
    const inputs = dtPorts.filter((p) => /input/i.test(p.label));
    const outputs = dtPorts.filter((p) => /output/i.test(p.label));

    const placePorts = (collection: DTNode[], yOffset: number) => {
      const step = collection.length > 1 ? width / (collection.length + 1) : width / 2;
      collection.forEach((port, idx) => {
        rfNodes.push({
          id: port.id,
          type: port.type,
          data: { label: port.label },
          position: { x: step * (idx + 1) - 9, y: yOffset },
          parentNode: dt.id,
          extent: "parent",
          draggable: false,
          selectable: false,
        });
      });
    };

    placePorts(inputs, 16);
    placePorts(outputs, height - 34);
  });

  const twinPorts = portNodes.filter((p) => twinsystems.some((tw) => tw.id === p.parentId));
  const portStartX = centerX - (twinPorts.length * 60) / 2;
  twinPorts.forEach((port, idx) => {
    rfNodes.push({
      id: port.id,
      type: port.type,
      data: { label: port.label },
      position: { x: portStartX + idx * 60, y: 460 },
      draggable: false,
      selectable: false,
    });
  });

  const orphanPorts = portNodes.filter(
    (p) => !digitalTwins.some((dt) => dt.id === p.parentId) && !twinsystems.some((tw) => tw.id === p.parentId)
  );
  orphanPorts.forEach((port, idx) => {
    rfNodes.push({
      id: port.id,
      type: port.type,
      data: { label: port.label },
      position: { x: 80 + idx * 60, y: 520 },
      draggable: false,
      selectable: false,
    });
  });

  for (const e of edges) {
    rfEdges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: {
        stroke: "#000",
        strokeWidth: 1.2,
        strokeDasharray: e.label === "allocate" ? "6 4" : undefined,
      },
      labelStyle: {
        fill: "#000",
        fontFamily: '"Times New Roman", serif',
        fontSize: 11,
        textTransform: "lowercase",
      },
      markerEnd: { type: "arrowclosed", color: "#000" },
    });
  }

  return { rfNodes, rfEdges };
}


/* ============================================================================
   Canvas
============================================================================ */
function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect }: any) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.1 }), 0);
    return () => clearTimeout(t);
  }, [nodes, fitView]);

  const nodeTypes = useMemo(
    () => ({
      port: PortNode,
      goal: GoalNode,
      dt: (p: any) => <BoxNode {...p} color="dt" />,
      twinsystem: (p: any) => <BoxNode {...p} color="twinsystem" />,
      dartwin: (p: any) => <BoxNode {...p} color="dartwin" />,
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
    >
    </ReactFlow>
  );
}

/* ============================================================================
   App
============================================================================ */
function InnerApp() {
  const [text, setText] = useState(sample);
  const parsed = useMemo(() => parseDarTwin(text), [text]);
  const { rfNodes, rfEdges } = useMemo(() => toRF(parsed.nodes, parsed.edges), [parsed]);
  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => {
    const { rfNodes: n2, rfEdges: e2 } = toRF(parsed.nodes, parsed.edges);
    setNodes(n2);
    setEdges(e2);
  }, [parsed, setNodes, setEdges]);

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
          onChange={(v) => setText(v || "")}
        />
      </div>

      <div className="panel">
        <h2>Diagram</h2>
        <div className="diagram-container">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          />
        </div>
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
