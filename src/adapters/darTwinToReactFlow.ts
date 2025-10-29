import type { DarTwinModel } from "../types/dartwin";
import type { DarTwinEdge, DarTwinGraph, DarTwinNode } from "../types/reactflow";

const toSegment = (value: string) => value.trim().replace(/\s+/g, "_");

const createIds = (model: DarTwinModel) => {
  const dartwinSegment = toSegment(model.name || "dartwin");
  const dartwinId = `dw::${dartwinSegment}`;
  const systemId = (system: string) => `ts::${dartwinSegment}::${toSegment(system)}`;
  const digitalId = (system: string, twin: string) =>
    `dt::${dartwinSegment}::${toSegment(system)}::${toSegment(twin)}`;
  const originalId = (system: string, twin: string) =>
    `at::${dartwinSegment}::${toSegment(system)}::${toSegment(twin)}`;
  const portId = (system: string, twin: string, port: string) =>
    `port::${dartwinSegment}::${toSegment(system)}::${toSegment(twin)}::${toSegment(port)}`;
  const goalId = (goal: string) => `goal::${dartwinSegment}::${toSegment(goal)}`;

  return { dartwinId, systemId, digitalId, originalId, portId, goalId };
};

const addNode = (collection: DarTwinNode[], node: DarTwinNode) => {
  collection.push(node);
};

const addEdge = (collection: DarTwinEdge[], edge: DarTwinEdge) => {
  collection.push(edge);
};

const setPortAliases = (
  map: Map<string, string>,
  primary: string,
  aliases: string[],
  id: string
) => {
  map.set(primary, id);
  aliases.forEach((alias) => {
    map.set(alias, id);
  });
};

const resolvePortId = (
  map: Map<string, string>,
  system: string,
  reference: string
): string | undefined => {
  const trimmed = reference.trim();
  if (map.has(trimmed)) {
    return map.get(trimmed);
  }
  const withSystem = `${system}.${trimmed}`;
  if (map.has(withSystem)) {
    return map.get(withSystem);
  }
  const systemPrefix = `${system}.`;
  if (trimmed.startsWith(systemPrefix)) {
    const withoutSystem = trimmed.slice(systemPrefix.length);
    if (map.has(withoutSystem)) {
      return map.get(withoutSystem);
    }
  }
  return undefined;
};

const resolveDigitalTwinId = (
  map: Map<string, string>,
  system: string,
  target: string
) => {
  const trimmed = target.trim();
  if (map.has(trimmed)) {
    return map.get(trimmed);
  }
  const systemPrefix = `${system}.`;
  if (trimmed.startsWith(systemPrefix)) {
    const withoutSystem = trimmed.slice(systemPrefix.length);
    return map.get(withoutSystem);
  }
  return undefined;
};

export function darTwinToReactFlow(model: DarTwinModel): DarTwinGraph {
  const { dartwinId, systemId, digitalId, originalId, portId, goalId } = createIds(model);
  const nodes: DarTwinNode[] = [];
  const edges: DarTwinEdge[] = [];

  addNode(nodes, { id: dartwinId, type: "dartwin", label: model.name || "" });

  const portLookup = new Map<string, string>();
  const digitalTwinLookup = new Map<string, string>();
  const goalLookup = new Map<string, string>();

  model.systems.forEach((system) => {
    const systemNodeId = systemId(system.name);
    addNode(nodes, {
      id: systemNodeId,
      type: "twinsystem",
      label: system.name,
      parentId: dartwinId,
    });

    system.digital_twins.forEach((dt) => {
      const dtNodeId = digitalId(system.name, dt.name);
      digitalTwinLookup.set(dt.name, dtNodeId);
      digitalTwinLookup.set(`${system.name}.${dt.name}`, dtNodeId);
      addNode(nodes, {
        id: dtNodeId,
        type: "dt",
        label: dt.name,
        parentId: systemNodeId,
      });

      dt.ports.forEach((port) => {
        const portNodeId = portId(system.name, dt.name, port);
        addNode(nodes, {
          id: portNodeId,
          type: "port",
          label: port,
          parentId: dtNodeId,
        });
        setPortAliases(
          portLookup,
          `${dt.name}.${port}`,
          [`${system.name}.${dt.name}.${port}`],
          portNodeId
        );
      });
    });

    system.original_twins.forEach((ot) => {
      const otNodeId = originalId(system.name, ot.name);
      addNode(nodes, {
        id: otNodeId,
        type: "at",
        label: ot.name,
        parentId: systemNodeId,
      });

      ot.ports.forEach((port) => {
        const portNodeId = portId(system.name, ot.name, port);
        addNode(nodes, {
          id: portNodeId,
          type: "port",
          label: port,
          parentId: otNodeId,
        });
        setPortAliases(
          portLookup,
          `${ot.name}.${port}`,
          [`${system.name}.${ot.name}.${port}`],
          portNodeId
        );
      });
    });

    system.connections.forEach((connection, index) => {
      const sourceId = resolvePortId(portLookup, system.name, connection.from);
      const targetId = resolvePortId(portLookup, system.name, connection.to);
      if (!sourceId || !targetId) {
        console.warn(
          `[darTwinToReactFlow] Skipping connection "${connection.from} -> ${connection.to}" because one of the ports is unknown.`
        );
        return;
      }

      addEdge(edges, {
        id: `connect::${toSegment(system.name)}::${index}`,
        source: sourceId,
        target: targetId,
        label: connection.name,
      });
    });
  });

  model.goals.forEach((goal) => {
    const goalNodeId = goalId(goal.name);
    goalLookup.set(goal.name, goalNodeId);
    addNode(nodes, {
      id: goalNodeId,
      type: "goal",
      label: goal.name,
      parentId: dartwinId,
      doc: goal.doc,
    });
  });

  model.allocations.forEach((allocation) => {
    const goalNodeId = goalLookup.get(allocation.goal);
    const targetId = resolveDigitalTwinId(digitalTwinLookup, allocation.target.split(".")[0] ?? "", allocation.target);
    if (!goalNodeId || !targetId) {
      console.warn(
        `[darTwinToReactFlow] Skipping allocation "${allocation.goal} -> ${allocation.target}" because referenced nodes are missing.`
      );
      return;
    }

    addEdge(edges, {
      id: `allocation::${toSegment(allocation.target)}::${toSegment(allocation.goal)}`,
      source: targetId,
      target: goalNodeId,
      label: "allocate",
    });
  });

  return { nodes, edges };
}
