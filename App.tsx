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
   Helpers
============================================================================ */
const formatLabel = (label: string) => {
  if (!label) return "";

  const spaced = label
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const collapsed = spaced.replace(/\b([A-Z])\s+([A-Z])\b/g, "$1$2");

  return collapsed
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};

const formatPortLabel = (label: string) => {
  let pretty = formatLabel(label);
  pretty = pretty.replace(/Multi Sensor/i, "Multi-sensor");
  return pretty;
};

/* ============================================================================
   Example DSL
============================================================================ */
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
  const captionSide = data.captionSide || "bottom";
  return (
    <div className={`port-node caption-${captionSide}`}>
      <div className="node port" title={data.label}></div>
      {data.caption ? <div className="port-caption">{data.caption}</div> : null}
    </div>
  );
}

function GoalNode({ data }: any) {
  return (
    <div className="node goal">
      <div className="goal-title">{data.label}</div>
      {data.doc ? <div className="goal-doc">{data.doc}</div> : null}
    </div>
  );
}

function TwinSystemNode({ data }: any) {
  return (
    <div className="node twinsystem">
      <span className="tw-prefix">twin.system</span>
      <em className="tw-name">{data.label}</em>
    </div>
  );
}

function DigitalTwinNode({ data }: any) {
  return (
    <div className="node dt">
      <span className="dt-name">{data.label}</span>
    </div>
  );
}

/* ============================================================================
   Layout Logic
============================================================================ */
function toRF(nodes: DTNode[], edges: DTEdge[]) {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  const canvasWidth = 720;
  const twinWidth = 520;
  const twinHeight = 320;
  const dtWidth = 300;
  const dtHeight = 180;

  const twinsystems = nodes.filter((n) => n.type === "twinsystem");
  const digitalTwins = nodes.filter((n) => n.type === "dt");
  const goalNodes = nodes.filter((n) => n.type === "goal");
  const portNodes = nodes.filter((n) => n.type === "port");

  const twinAreaWidth = twinsystems.length > 0 ? twinsystems.length * (twinWidth + 40) - 40 : twinWidth;
  const goalsStartX = (canvasWidth - Math.max(twinAreaWidth, 320)) / 2 + 20;
  const goalSpacing =
    goalNodes.length > 1 ? Math.min((twinWidth - 160) / (goalNodes.length - 1), 280) : 0;

  goalNodes.forEach((goal, idx) => {
    rfNodes.push({
      id: goal.id,
      type: goal.type,
      data: {
        label: formatLabel(goal.label),
        doc: goal.doc,
      },
      position: {
        x: goalsStartX + idx * goalSpacing,
        y: 28,
      },
      style: {
        width: 210,
        height: 88,
      },
      draggable: false,
      selectable: false,
    });
  });

  twinsystems.forEach((tw, idx) => {
    const twinX = (canvasWidth - twinWidth) / 2 + idx * (twinWidth + 40);
    const twinY = 188;

    rfNodes.push({
      id: tw.id,
      type: tw.type,
      data: { label: formatLabel(tw.label) },
      position: { x: twinX, y: twinY },
      style: {
        width: twinWidth,
        height: twinHeight,
        alignItems: "flex-start",
        justifyContent: "flex-start",
        padding: "62px 48px 110px",
      },
      draggable: false,
      selectable: false,
    });

    const containedDigitalTwins = digitalTwins.filter((dt) => dt.parentId === tw.id);
    const dtOffsetX = (twinWidth - dtWidth) / 2;
    const dtOffsetY = 96;

    const addPortNode = (
      port: DTNode,
      x: number,
      y: number,
      options: {
        parent?: string;
        orientation?: "top" | "bottom" | "left" | "right";
        caption?: string;
        captionSide?: "bottom" | "right" | "left" | "top";
      } = {}
    ) => {
      const node: Node = {
        id: port.id,
        type: port.type,
        data: {
          label: formatPortLabel(port.label),
          caption: options.caption,
          captionSide: options.captionSide,
        },
        position: { x, y },
        draggable: false,
        selectable: false,
      };

      if (options.parent) {
        node.parentNode = options.parent;
        node.extent = "parent";
      }

      switch (options.orientation) {
        case "top":
          node.sourcePosition = "top";
          node.targetPosition = "bottom";
          break;
        case "bottom":
          node.sourcePosition = "bottom";
          node.targetPosition = "top";
          break;
        case "left":
          node.sourcePosition = "left";
          node.targetPosition = "right";
          break;
        case "right":
          node.sourcePosition = "right";
          node.targetPosition = "left";
          break;
        default:
          break;
      }

      rfNodes.push(node);
      return node;
    };

    const twinPorts = portNodes.filter((p) => p.parentId === tw.id);
    let dtLayout: { baseX: number; step: number; y: number } | null = null;

    containedDigitalTwins.forEach((dt, index) => {
      const dtX = dtOffsetX + index * (dtWidth + 40);
      const dtY = dtOffsetY;

      rfNodes.push({
        id: dt.id,
        type: dt.type,
        data: { label: formatLabel(dt.label).replace(/Dt\b/, "DT") },
        position: { x: dtX, y: dtY },
        style: {
          width: dtWidth,
          height: dtHeight,
          padding: "26px 28px 70px",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        },
        parentNode: tw.id,
        extent: "parent",
        draggable: false,
        selectable: false,
      });

      const dtPorts = portNodes.filter((p) => p.parentId === dt.id);
      const inputPorts = dtPorts.filter((p) => /input/i.test(p.label));
      const outputPorts = dtPorts.filter((p) => /output/i.test(p.label));

      inputPorts.forEach((port) => {
        addPortNode(port, dtWidth - 18, dtHeight / 2 - 9, {
          parent: dt.id,
          orientation: "right",
        });
      });

      const outputOrder = [
        "actuator_output_irrigation",
        "actuator_output_human",
        "actuator_output_ventilation",
      ];
      const orderedOutputs = [...outputPorts].sort((a, b) => {
        const aIdx = outputOrder.indexOf(a.label);
        const bIdx = outputOrder.indexOf(b.label);
        return (aIdx === -1 ? outputOrder.length : aIdx) - (bIdx === -1 ? outputOrder.length : bIdx);
      });
      const step = orderedOutputs.length > 1 ? dtWidth / (orderedOutputs.length + 1) : dtWidth / 2;

      if (!dtLayout) {
        dtLayout = { baseX: dtX, step, y: dtY };
      }

      orderedOutputs.forEach((port, idx) => {
        addPortNode(port, step * (idx + 1) - 9, dtHeight - 32, {
          parent: dt.id,
          orientation: "bottom",
        });
      });

      orderedOutputs.forEach((port, idx) => {
        const next = orderedOutputs[idx + 1];
        if (!next) return;
        rfEdges.push({
          id: `${port.id}_internal_${next.id}`,
          source: port.id,
          target: next.id,
          style: {
            stroke: "#000",
            strokeWidth: 1.2,
          },
          markerEnd: { type: "arrowclosed", color: "#000" },
        });
      });
    });

    if (dtLayout) {
      const bottomPorts = twinPorts
        .filter((p) => /Actuator$/i.test(p.label))
        .sort((a, b) => {
          const order = ["IrrigationActuator", "HumanActuator", "VentilationActuator"];
          const aIdx = order.indexOf(a.label);
          const bIdx = order.indexOf(b.label);
          return (aIdx === -1 ? order.length : aIdx) - (bIdx === -1 ? order.length : bIdx);
        });

      bottomPorts.forEach((port, idx) => {
        const portX = dtLayout!.baseX + dtLayout!.step * (idx + 1) - 9;
        addPortNode(port, portX, twinHeight - 86, {
          parent: tw.id,
          orientation: "top",
          caption: formatPortLabel(port.label),
        });
      });

      const sidePorts = twinPorts.filter((p) => /MultiSensor/i.test(p.label));
      sidePorts.forEach((port) => {
        addPortNode(port, twinWidth - 78, dtLayout!.y + dtHeight / 2 - 9, {
          parent: tw.id,
          orientation: "right",
          caption: formatPortLabel(port.label),
          captionSide: "right",
        });
      });
    }
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
  const dartwinNode = useMemo(() => parsed.nodes.find((n) => n.type === "dartwin"), [parsed]);
  const dartwinTitle = useMemo(() => formatLabel(dartwinNode?.label ?? ""), [dartwinNode]);
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
          <div className="diagram-overlay" aria-hidden="true">
            <div className="overlay-tab">
              <span className="tab-brand">dartwin</span>
              <span className="tab-title">{dartwinTitle}</span>
            </div>
            <div className="overlay-divider">
              <span className="divider-marker marker-left"></span>
              <span className="divider-marker marker-right"></span>
            </div>
          </div>
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
