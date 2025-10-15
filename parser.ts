import type { DarTwinEdge, DarTwinNode } from "./types";

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

export function parseDarTwin(text: string): { nodes: DarTwinNode[]; edges: DarTwinEdge[] } {
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

  const twinHeader = /#twinsystem\s+(\w+)\s*\{/g;
  let twinMatch: RegExpExecArray | null;
  while ((twinMatch = twinHeader.exec(dwBody))) {
    const twinName = twinMatch[1];
    const open = dwBody.indexOf("{", twinMatch.index);
    const { body: twinBody, end } = extractBlock(dwBody, open);
    const twinId = `${dwId}_twinsystem_${twinName}`;
    nodes.push({ id: twinId, type: "twinsystem", label: twinName, parentId: dwId });

    const dtHeader = /#digitaltwin\s+(\w+)\s*\{/g;
    let dtMatch: RegExpExecArray | null;
    while ((dtMatch = dtHeader.exec(twinBody))) {
      const dtName = dtMatch[1];
      const dtOpen = twinBody.indexOf("{", dtMatch.index);
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

    const partHeader = /part\s+(\w+)\s*\{/g;
    let partMatch: RegExpExecArray | null;
    while ((partMatch = partHeader.exec(twinBody))) {
      const partOpen = twinBody.indexOf("{", partMatch.index);
      const { body: partBody } = extractBlock(twinBody, partOpen);
      const twinPorts = /port\s+(\w+)\s*;/g;
      let twinPortMatch: RegExpExecArray | null;
      while ((twinPortMatch = twinPorts.exec(partBody))) {
        const portName = twinPortMatch[1];
        nodes.push({
          id: `${twinId}_port_${portName}`,
          type: "port",
          label: portName,
          parentId: twinId,
        });
      }
    }

    const connections = /connect\s+([\w\.]+)\s+to\s+([\w\.]+)\s*;/g;
    let connectionMatch: RegExpExecArray | null;
    while ((connectionMatch = connections.exec(twinBody))) {
      const left = `${twinId}_${connectionMatch[1].replace(/\./g, "_")}`;
      const right = `${twinId}_${connectionMatch[2].replace(/\./g, "_")}`;
      edges.push({ id: `c_${edges.length}`, source: left, target: right });
    }

    twinHeader.lastIndex = twinMatch.index + (end - open) + 1;
  }

  const goalHeader = /#goal\s+(\w+)\s*(\{)?/g;
  let goalMatch: RegExpExecArray | null;
  while ((goalMatch = goalHeader.exec(dwBody))) {
    const goalName = goalMatch[1];
    let doc: string | undefined;
    if (goalMatch[2] === "{") {
      const open = dwBody.indexOf("{", goalMatch.index);
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

  const allocations = /allocate\s+(\w+)\s+to\s+([\w\.]+)\s*;/g;
  let allocationMatch: RegExpExecArray | null;
  while ((allocationMatch = allocations.exec(dwBody))) {
    edges.push({
      id: `alloc_${allocationMatch[1]}`,
      source: `${dwId}_goal_${allocationMatch[1]}`,
      target: `${dwId}_${allocationMatch[2].replace(/\./g, "_")}`,
      label: "allocate",
    });
  }

  return { nodes, edges };
}
