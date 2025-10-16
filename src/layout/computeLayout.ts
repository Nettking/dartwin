import { MarkerType, type Edge, type Node } from "reactflow";
import type { ParsedDarTwin } from "../parser/parseDarTwin";
import type { DarTwinNode } from "../types";
import { formatLabel, formatPortLabel } from "../utils/format";

const CANVAS_MARGIN_X = 120;
const GOAL_ROW_Y = 60;
const GOAL_WIDTH = 240;
const GOAL_HEIGHT = 120;
const GOAL_HORIZONTAL_GAP = 80;

const TWIN_ROW_Y = 240;
const TWIN_WIDTH = 520;
const TWIN_HEIGHT = 340;
const TWIN_HORIZONTAL_GAP = 160;

const DT_WIDTH = 320;
const DT_HEIGHT = 160;
const DT_GAP = 60;

const PORT_WIDTH = 120;
const PORT_HEIGHT = 56;

const SENSOR_GAP = 70;
const SENSOR_CHAIN_GAP = 80;
const SENSOR_STACK_GAP = 28;

const ACTUATOR_VERTICAL_GAP = 70;
const ACTUATOR_CHAIN_GAP = 90;
const ACTUATOR_HORIZONTAL_GAP = 48;

const SIDE_PORT_GAP = 100;
const SIDE_PORT_STACK_GAP = 36;

const TWIN_TOP_PADDING = 40;
const TWIN_SIDE_GAP = 120;

interface PositionMap {
  [id: string]: { x: number; y: number };
}

const groupByParent = (nodes: DarTwinNode[], parentId: string) =>
  nodes.filter((node) => node.parentId === parentId);

const byLabel = (a: DarTwinNode, b: DarTwinNode) => a.label.localeCompare(b.label);

const isSensorPort = (node: DarTwinNode) => /sensor|input/i.test(node.label);

const isActuatorPort = (node: DarTwinNode) => /actuator|output/i.test(node.label);

const NODE_DIMENSIONS: Partial<Record<DarTwinNode["type"], { width: number; height: number }>> = {
  goal: { width: GOAL_WIDTH, height: GOAL_HEIGHT },
  twinsystem: { width: TWIN_WIDTH, height: TWIN_HEIGHT },
  dt: { width: DT_WIDTH, height: DT_HEIGHT },
  port: { width: PORT_WIDTH, height: PORT_HEIGHT },
};

const setGoalPositions = (goals: DarTwinNode[], positions: PositionMap) => {
  goals
    .slice()
    .sort(byLabel)
    .forEach((goal, index) => {
      positions[goal.id] = {
        x: CANVAS_MARGIN_X + index * (GOAL_WIDTH + GOAL_HORIZONTAL_GAP),
        y: GOAL_ROW_Y,
      };
    });
};

interface DigitalTwinAnchors {
  sensorBaseX: number;
  sensorY: number;
  actuatorStartX: number;
  actuatorY: number;
  actuatorCount: number;
}

const layoutDigitalTwin = (
  twinPosition: { x: number; y: number },
  dt: DarTwinNode,
  dtIndex: number,
  dtCount: number,
  allPorts: DarTwinNode[],
  positions: PositionMap
): DigitalTwinAnchors => {
  const dtSpanWidth = dtCount * DT_WIDTH + Math.max(0, dtCount - 1) * DT_GAP;
  const dtStartX = twinPosition.x + (TWIN_WIDTH - dtSpanWidth) / 2;
  const dtX = dtStartX + dtIndex * (DT_WIDTH + DT_GAP);
  const dtY = twinPosition.y + (TWIN_HEIGHT - DT_HEIGHT) / 2;

  positions[dt.id] = { x: dtX, y: dtY };

  const dtPorts = groupByParent(allPorts, dt.id).sort(byLabel);
  const sensorPorts = dtPorts.filter(isSensorPort);
  const actuatorPorts = dtPorts.filter(isActuatorPort);
  const remainingPorts = dtPorts.filter(
    (port) => !sensorPorts.includes(port) && !actuatorPorts.includes(port)
  );

  const sensorBaseX = dtX + DT_WIDTH + SENSOR_GAP;
  const sensorY = dtY + DT_HEIGHT / 2 - PORT_HEIGHT / 2;
  sensorPorts.forEach((port, index) => {
    positions[port.id] = {
      x: sensorBaseX + index * (PORT_WIDTH + SENSOR_STACK_GAP),
      y: sensorY,
    };
  });

  const actuatorRowWidth =
    actuatorPorts.length * PORT_WIDTH +
    Math.max(0, actuatorPorts.length - 1) * ACTUATOR_HORIZONTAL_GAP;
  const actuatorStartX =
    actuatorPorts.length > 0
      ? dtX + (DT_WIDTH - actuatorRowWidth) / 2
      : dtX + (DT_WIDTH - PORT_WIDTH) / 2;
  const actuatorY = dtY + DT_HEIGHT + ACTUATOR_VERTICAL_GAP;
  actuatorPorts.forEach((port, index) => {
    positions[port.id] = {
      x: actuatorStartX + index * (PORT_WIDTH + ACTUATOR_HORIZONTAL_GAP),
      y: actuatorY,
    };
  });

  if (remainingPorts.length > 0) {
    const totalHeight =
      remainingPorts.length * PORT_HEIGHT +
      Math.max(0, remainingPorts.length - 1) * SIDE_PORT_STACK_GAP;
    const startY = dtY + (DT_HEIGHT - totalHeight) / 2;
    const leftX = dtX - SIDE_PORT_GAP - PORT_WIDTH;
    remainingPorts.forEach((port, index) => {
      positions[port.id] = {
        x: leftX,
        y: startY + index * (PORT_HEIGHT + SIDE_PORT_STACK_GAP),
      };
    });
  }

  return {
    sensorBaseX,
    sensorY,
    actuatorStartX,
    actuatorY,
    actuatorCount: actuatorPorts.length,
  };
};

const layoutTwinPorts = (
  twin: DarTwinNode,
  allPorts: DarTwinNode[],
  anchors: DigitalTwinAnchors | undefined,
  positions: PositionMap
) => {
  const twinPorts = groupByParent(allPorts, twin.id).sort(byLabel);
  const sensorPorts = twinPorts.filter(isSensorPort);
  const actuatorPorts = twinPorts.filter(isActuatorPort);
  const remainingPorts = twinPorts.filter(
    (port) => !sensorPorts.includes(port) && !actuatorPorts.includes(port)
  );

  const twinPosition = positions[twin.id] ?? { x: CANVAS_MARGIN_X, y: TWIN_ROW_Y };
  const baseSensorX = anchors
    ? anchors.sensorBaseX + PORT_WIDTH + SENSOR_CHAIN_GAP
    : twinDefaultSensorX(twinPosition);
  const baseSensorY = anchors
    ? anchors.sensorY
    : twinPosition.y + TWIN_HEIGHT / 2 - PORT_HEIGHT / 2;
  sensorPorts.forEach((port, index) => {
    positions[port.id] = {
      x: baseSensorX + index * (PORT_WIDTH + SENSOR_STACK_GAP),
      y: baseSensorY,
    };
  });

  const twinActuatorRowWidth =
    actuatorPorts.length * PORT_WIDTH +
    Math.max(0, actuatorPorts.length - 1) * ACTUATOR_HORIZONTAL_GAP;
  const fallbackActuatorStartX =
    actuatorPorts.length > 0
      ? twinPosition.x + (TWIN_WIDTH - twinActuatorRowWidth) / 2
      : twinPosition.x + (TWIN_WIDTH - PORT_WIDTH) / 2;
  const baseActuatorStartX =
    anchors && actuatorPorts.length === anchors.actuatorCount
      ? anchors.actuatorStartX
      : fallbackActuatorStartX;
  const actuatorY =
    (anchors?.actuatorY ?? twinPosition.y + TWIN_HEIGHT / 2) + PORT_HEIGHT + ACTUATOR_CHAIN_GAP;
  actuatorPorts.forEach((port, index) => {
    positions[port.id] = {
      x: baseActuatorStartX + index * (PORT_WIDTH + ACTUATOR_HORIZONTAL_GAP),
      y: actuatorY,
    };
  });

  if (remainingPorts.length > 0) {
    const baseX = twinPosition.x - TWIN_SIDE_GAP - PORT_WIDTH;
    remainingPorts.forEach((port, index) => {
      positions[port.id] = {
        x: baseX,
        y:
          twinPosition.y +
          TWIN_TOP_PADDING +
          index * (PORT_HEIGHT + SIDE_PORT_STACK_GAP),
      };
    });
  }
};

const twinDefaultSensorX = (twinPosition: { x: number; y: number }) =>
  twinPosition.x + TWIN_WIDTH + SENSOR_GAP;

const setTwinHierarchyPositions = (
  twins: DarTwinNode[],
  allNodes: DarTwinNode[],
  positions: PositionMap
) => {
  const dts = allNodes.filter((node) => node.type === "dt");
  const ports = allNodes.filter((node) => node.type === "port");

  twins
    .slice()
    .sort(byLabel)
    .forEach((twin, twinIndex) => {
      const twinX = CANVAS_MARGIN_X + twinIndex * (TWIN_WIDTH + TWIN_HORIZONTAL_GAP);
      const twinY = TWIN_ROW_Y;
      positions[twin.id] = { x: twinX, y: twinY };

      const twinDigitalTwins = groupByParent(dts, twin.id).sort(byLabel);
      const anchors = twinDigitalTwins.map((dt, index) =>
        layoutDigitalTwin({ x: twinX, y: twinY }, dt, index, twinDigitalTwins.length, ports, positions)
      );

      const primaryAnchor = anchors[0];
      layoutTwinPorts(twin, ports, primaryAnchor, positions);
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
  const abs = positions[node.id] ?? fallbackPosition(index);
  const dims = NODE_DIMENSIONS[node.type];
  const style = dims ? { width: dims.width, height: dims.height } : undefined;

  // Default to absolute position
  let position = { ...abs };

  // Convert to relative coordinates if node has a parent
  if (node.parentId && positions[node.parentId]) {
    const parentPos = positions[node.parentId];
    position = {
      x: abs.x - parentPos.x,
      y: abs.y - parentPos.y,
    };
  }

  const base: Partial<Node> = {
    id: node.id,
    position,
    style,
    data: {
      kind: node.type,
      parent: node.parentId,
    },
    parentNode: node.parentId,
  };

  switch (node.type) {
    case "goal":
      return {
        ...base,
        type: "goal",
        data: { ...base.data, label: formatLabel(node.label), doc: node.doc },
      } as Node;

    case "twinsystem":
      return {
        ...base,
        type: "twinsystem",
        extent: "parent", // key: this allows nesting
        data: { ...base.data, label: formatLabel(node.label) },
      } as Node;

    case "dt":
      return {
        ...base,
        type: "dt",
        data: {
          ...base.data,
          label: formatLabel(node.label).replace(/Dt\b/i, "DT"),
        },
      } as Node;

    case "port":
      return {
        ...base,
        type: "port",
        data: {
          ...base.data,
          label: node.label,
          caption: formatPortLabel(node.label),
        },
      } as Node;

    default:
      return {
        ...base,
        type: "dartwin",
        data: { ...base.data, label: formatLabel(node.label) },
      } as Node;
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
  const goals = parsed.nodes.filter((n) => n.type === "goal");
  const twins = parsed.nodes.filter((n) => n.type === "twinsystem");

  setGoalPositions(goals, positions);
  setTwinHierarchyPositions(twins, parsed.nodes, positions);

  const nodes = parsed.nodes.map((node, index) => buildNode(node, index, positions)); 
  const edges = parsed.edges.map(buildEdge);

  return { nodes, edges };
}

