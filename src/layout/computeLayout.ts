import { MarkerType, type Edge, type Node } from "reactflow";
import type { ParsedDarTwin } from "../parser/parseDarTwin";
import type { DarTwinNode } from "../types";
import { formatLabel, formatPortLabel } from "../utils/format";

const GOAL_ROW_Y = 60;
const TWIN_ROW_Y = 220;
const DT_ROW_Y = 320;
const PORT_ROW_Y = 480;

const GOAL_SPACING = 260;
const TWIN_SPACING = 420;
const DT_SPACING = 240;
const PORT_SPACING = 80;

interface PositionMap {
  [id: string]: { x: number; y: number };
}

const groupByParent = (nodes: DarTwinNode[], parentId: string) =>
  nodes.filter((node) => node.parentId === parentId);

const byLabel = (a: DarTwinNode, b: DarTwinNode) => a.label.localeCompare(b.label);

const setGoalPositions = (goals: DarTwinNode[], positions: PositionMap) => {
  goals.forEach((goal, index) => {
    positions[goal.id] = {
      x: 140 + index * GOAL_SPACING,
      y: GOAL_ROW_Y,
    };
  });
};

const setTwinHierarchyPositions = (
  twins: DarTwinNode[],
  allNodes: DarTwinNode[],
  positions: PositionMap
) => {
  const dts = allNodes.filter((node) => node.type === "dt");
  const ports = allNodes.filter((node) => node.type === "port");

  twins.forEach((twin, twinIndex) => {
    const baseX = 200 + twinIndex * TWIN_SPACING;
    positions[twin.id] = { x: baseX, y: TWIN_ROW_Y };

    const twinDigitalTwins = groupByParent(dts, twin.id).sort(byLabel);

    twinDigitalTwins.forEach((dt, dtIndex) => {
      const dtX = baseX + 40 + dtIndex * DT_SPACING;
      positions[dt.id] = { x: dtX, y: DT_ROW_Y };

      const dtPorts = groupByParent(ports, dt.id).sort(byLabel);
      dtPorts.forEach((port, portIndex) => {
        positions[port.id] = {
          x: dtX + portIndex * PORT_SPACING,
          y: PORT_ROW_Y,
        };
      });
    });

    const twinPorts = groupByParent(ports, twin.id).sort(byLabel);
    twinPorts.forEach((port, portIndex) => {
      const offset = twinDigitalTwins.length > 0 ? -PORT_SPACING : 0;
      positions[port.id] = {
        x: baseX + offset + portIndex * PORT_SPACING,
        y: PORT_ROW_Y,
      };
    });
  });
};

const fallbackPosition = (index: number): { x: number; y: number } => ({
  x: 120 + (index % 4) * 140,
  y: 160 + Math.floor(index / 4) * 140,
});

const buildNode = (
  node: DarTwinNode,
  index: number,
  positions: PositionMap
): Node => {
  const position = positions[node.id] ?? fallbackPosition(index);
  const common = {
    id: node.id,
    position,
    data: {
      parent: node.parentId,
      kind: node.type,
    },
  } as const;

  switch (node.type) {
    case "goal":
      return {
        ...common,
        type: "goal",
        data: {
          ...common.data,
          label: formatLabel(node.label),
          doc: node.doc,
        },
      };
    case "twinsystem":
      return {
        ...common,
        type: "twinsystem",
        data: {
          ...common.data,
          label: formatLabel(node.label),
        },
      };
    case "dt":
      return {
        ...common,
        type: "dt",
        data: {
          ...common.data,
          label: formatLabel(node.label).replace(/Dt\b/i, "DT"),
        },
      };
    case "port":
      return {
        ...common,
        type: "port",
        data: {
          ...common.data,
          label: node.label,
          caption: formatPortLabel(node.label),
        },
      };
    default:
      return {
        ...common,
        type: "dartwin",
        data: {
          ...common.data,
          label: formatLabel(node.label),
        },
      };
  }
};

const buildEdge = (edge: ParsedDarTwin["edges"][number]): Edge => ({
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
  markerEnd: { type: MarkerType.ArrowClosed, color: "#000" },
});

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function computeLayout(parsed: ParsedDarTwin): LayoutResult {
  const positions: PositionMap = {};
  const goals = parsed.nodes.filter((node) => node.type === "goal");
  const twins = parsed.nodes.filter((node) => node.type === "twinsystem");

  setGoalPositions(goals, positions);
  setTwinHierarchyPositions(twins, parsed.nodes, positions);

  const nodes = parsed.nodes
    .filter((node) => node.type !== "dartwin")
    .map((node, index) => buildNode(node, index, positions));
  const edges = parsed.edges.map(buildEdge);

  return { nodes, edges };
}
