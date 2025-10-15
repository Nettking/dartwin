import type { Edge, Node } from "reactflow";
import type { DarTwinEdge, DarTwinNode } from "./types";
import { formatLabel, formatPortLabel } from "./utils/format";

const CANVAS_WIDTH = 720;
const TWIN_WIDTH = 520;
const TWIN_HEIGHT = 320;
const DT_WIDTH = 300;
const DT_HEIGHT = 180;

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

const goalSpacingFor = (goalCount: number) => {
  if (goalCount <= 1) return 0;
  return Math.min((TWIN_WIDTH - 160) / (goalCount - 1), 280);
};

function createGoalNodes(goalNodes: DarTwinNode[]): Node[] {
  const goalSpacing = goalSpacingFor(goalNodes.length);
  const twinAreaWidth = goalNodes.length > 0 ? Math.max(TWIN_WIDTH, 320) : TWIN_WIDTH;
  const goalsStartX = (CANVAS_WIDTH - twinAreaWidth) / 2 + 20;

  return goalNodes.map((goal, idx) => ({
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
  }));
}

function createTwinSystemNodes(
  twinSystems: DarTwinNode[],
  allNodes: DarTwinNode[],
  existingEdges: Edge[]
): Node[] {
  const nodes: Node[] = [];
  const portNodes = allNodes.filter((n) => n.type === "port");
  const digitalTwins = allNodes.filter((n) => n.type === "dt");

  twinSystems.forEach((tw, idx) => {
    const twinX = (CANVAS_WIDTH - TWIN_WIDTH) / 2 + idx * (TWIN_WIDTH + 40);
    const twinY = 188;

    nodes.push({
      id: tw.id,
      type: tw.type,
      data: { label: formatLabel(tw.label) },
      position: { x: twinX, y: twinY },
      style: {
        width: TWIN_WIDTH,
        height: TWIN_HEIGHT,
      },
    });

    const containedDigitalTwins = digitalTwins.filter((dt) => dt.parentId === tw.id);
    const twinPorts = portNodes.filter((p) => p.parentId === tw.id);
    const dtOffsetX = (TWIN_WIDTH - DT_WIDTH) / 2;
    const dtOffsetY = 96;
    let dtLayout: { baseX: number; step: number; y: number } | null = null;

    const addPortNode = (
      port: DarTwinNode,
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

      nodes.push(node);
      return node;
    };

    containedDigitalTwins.forEach((dt, index) => {
      const dtX = dtOffsetX + index * (DT_WIDTH + 40);
      const dtY = dtOffsetY;

      nodes.push({
        id: dt.id,
        type: dt.type,
        data: { label: formatLabel(dt.label).replace(/Dt\b/, "DT") },
        position: { x: dtX, y: dtY },
        style: {
          width: DT_WIDTH,
          height: DT_HEIGHT,
        },
        parentNode: tw.id,
        extent: "parent",
      });

      const dtPorts = portNodes.filter((p) => p.parentId === dt.id);
      const inputPorts = dtPorts.filter((p) => /input/i.test(p.label));
      const outputPorts = dtPorts.filter((p) => /output/i.test(p.label));

      inputPorts.forEach((port) => {
        addPortNode(port, DT_WIDTH - 18, DT_HEIGHT / 2 - 9, {
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
      const step = orderedOutputs.length > 1 ? DT_WIDTH / (orderedOutputs.length + 1) : DT_WIDTH / 2;

      if (!dtLayout) {
        dtLayout = { baseX: dtX, step, y: dtY };
      }

      orderedOutputs.forEach((port, outputIdx) => {
        const portNode = addPortNode(port, step * (outputIdx + 1) - 9, DT_HEIGHT - 32, {
          parent: dt.id,
          orientation: "bottom",
        });

        const next = orderedOutputs[outputIdx + 1];
        if (!next) return;
        existingEdges.push({
          id: `${portNode.id}_internal_${next.id}`,
          source: portNode.id,
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
        addPortNode(port, portX, TWIN_HEIGHT - 86, {
          parent: tw.id,
          orientation: "top",
          caption: formatPortLabel(port.label),
        });
      });

      const sidePorts = twinPorts.filter((p) => /MultiSensor/i.test(p.label));
      sidePorts.forEach((port) => {
        addPortNode(port, TWIN_WIDTH - 78, dtLayout!.y + DT_HEIGHT / 2 - 9, {
          parent: tw.id,
          orientation: "right",
          caption: formatPortLabel(port.label),
          captionSide: "right",
        });
      });
    }
  });

  return nodes;
}

function createEdges(edges: DarTwinEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    style: {
      stroke: "#000",
      strokeWidth: 1.2,
      strokeDasharray: edge.label === "allocate" ? "6 4" : undefined,
    },
    labelStyle: {
      fill: "#000",
      fontFamily: '"Times New Roman", serif',
      fontSize: 11,
      textTransform: "lowercase",
    },
    markerEnd: { type: "arrowclosed", color: "#000" },
  }));
}

export function layoutDarTwin(nodes: DarTwinNode[], edges: DarTwinEdge[]): LayoutResult {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  const goalNodes = nodes.filter((n) => n.type === "goal");
  const twinSystems = nodes.filter((n) => n.type === "twinsystem");

  rfNodes.push(...createGoalNodes(goalNodes));
  rfNodes.push(...createTwinSystemNodes(twinSystems, nodes, rfEdges));
  rfEdges.push(...createEdges(edges));

  return { nodes: rfNodes, edges: rfEdges };
}
