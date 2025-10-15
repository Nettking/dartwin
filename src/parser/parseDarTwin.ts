import type { DarTwinEdge, DarTwinNode } from "../types";

export interface ParsedDarTwin {
  nodes: DarTwinNode[];
  edges: DarTwinEdge[];
}

/**
 * Safely extracts a {...} block relative to a given string.
 */
const extractBlock = (src: string, openIdx: number) => {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return { body: src.slice(openIdx + 1, i), end: i };
      }
    }
  }
  return { body: "", end: src.length };
};

/**
 * Main parser for the DarTwin DSL.
 */
export function parseDarTwin(text: string): ParsedDarTwin {
  const nodes: DarTwinNode[] = [];
  const edges: DarTwinEdge[] = [];

  const dwHeader = /#dartwin\s+(\w+)\s*\{/;
  const dwMatch = dwHeader.exec(text);
  if (!dwMatch) return { nodes, edges };

  const dartwinLabel = dwMatch[1];
  const dwOpen = text.indexOf("{", dwMatch.index!);
  const { body: dwBody } = extractBlock(text, dwOpen);
  const dwId = `dartwin_${dartwinLabel}`;
  nodes.push({ id: dwId, type: "dartwin", label: dartwinLabel });

  // === Parse twin systems ===
  const twinHeader = /#twinsystem\s+(\w+)\s*\{/g;
  let twinMatch: RegExpExecArray | null;

  const pendingEdges: DarTwinEdge[] = []; // buffer until all nodes parsed

  while ((twinMatch = twinHeader.exec(dwBody))) {
    const twinName = twinMatch[1];
    const open = twinMatch.index + twinMatch[0].length - 1;
    const { body: twinBody } = extractBlock(dwBody, open);
    const twinId = `${dwId}_twinsystem_${twinName}`;
    nodes.push({ id: twinId, type: "twinsystem", label: twinName, parentId: dwId });

    // === digital twins inside twinsystem ===
    const dtHeader = /#digitaltwin\s+(\w+)\s*\{/g;
    let dtMatch: RegExpExecArray | null;
    while ((dtMatch = dtHeader.exec(twinBody))) {
      const dtName = dtMatch[1];
      const dtOpen = dtMatch.index + dtMatch[0].length - 1;
      const { body: dtBody } = extractBlock(twinBody, dtOpen);
      const dtId = `${twinId}_dt_${dtName}`;
      nodes.push({ id: dtId, type: "dt", label: dtName, parentId: twinId });

      const dtPorts = /port\s+(\w+)\s*;/g;
      let portMatch: RegExpExecArray | null;
      while ((portMatch = dtPorts.exec(dtBody))) {
        const portName = portMatch[1];
        nodes.push({
          id: `${dtId}_port_${portName}`,
          type: "port",
          label: portName,
          parentId: dtId,
        });
      }
    }

    // === parts inside twinsystem ===
    const partHeader = /part\s+(\w+)\s*\{/g;
    let partMatch: RegExpExecArray | null;
    while ((partMatch = partHeader.exec(twinBody))) {
      const partName = partMatch[1];
      const partOpen = partMatch.index + partMatch[0].length - 1;
      const { body: partBody } = extractBlock(twinBody, partOpen);
      const portRegex = /port\s+(\w+)\s*;/g;
      let twinPortMatch: RegExpExecArray | null;
      while ((twinPortMatch = portRegex.exec(partBody))) {
        const portName = twinPortMatch[1];
        nodes.push({
          id: `${twinId}_part_${partName}_port_${portName}`,
          type: "port",
          label: portName,
          parentId: twinId,
        });
      }
    }

    // === connect statements ===
    const connectRegex = /connect\s+([\w\.]+)\s+to\s+([\w\.]+)\s*;/g;
    let connectionMatch: RegExpExecArray | null;
    while ((connectionMatch = connectRegex.exec(twinBody))) {
      const src = `${twinId}_${connectionMatch[1].replace(/\./g, "__")}`;
      const tgt = `${twinId}_${connectionMatch[2].replace(/\./g, "__")}`;
      pendingEdges.push({ id: `c_${pendingEdges.length}`, source: src, target: tgt });
    }
  }

  // === goals ===
  const goalHeader = /#goal\s+(\w+)\s*(\{)?/g;
  let goalMatch: RegExpExecArray | null;
  while ((goalMatch = goalHeader.exec(dwBody))) {
    const goalName = goalMatch[1];
    let doc: string | undefined;
    const braceOpen = goalMatch.index + goalMatch[0].length - 1;
    if (dwBody[braceOpen] === "{") {
      const { body: goalBody, end } = extractBlock(dwBody, braceOpen);
      const docMatch = /doc\s*\/\*([\s\S]*?)\*\//.exec(goalBody);
      if (docMatch) {
        doc = docMatch[1].replace(/\s+/g, " ").trim();
      }
      goalHeader.lastIndex = end;
    }

    nodes.push({
      id: `${dwId}_goal_${goalName}`,
      type: "goal",
      label: goalName,
      parentId: dwId,
      doc,
    });
  }

  // === allocations ===
  const allocRegex = /allocate\s+(\w+)\s+to\s+([\w\.]+)\s*;/g;
  let allocMatch: RegExpExecArray | null;
  while ((allocMatch = allocRegex.exec(dwBody))) {
    pendingEdges.push({
      id: `alloc_${allocMatch[1]}`,
      source: `${dwId}_goal_${allocMatch[1]}`,
      target: `${dwId}_${allocMatch[2].replace(/\./g, "__")}`,
      label: "allocate",
    });
  }

  // === final edge filtering ===
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const e of pendingEdges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      edges.push(e);
    }
  }

  return { nodes, edges };
}
