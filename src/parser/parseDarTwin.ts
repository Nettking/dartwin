import type {
  Allocation,
  Connection,
  DarTrans,
  DarTwinModel,
  Goal,
  PartialDarTwinSlice,
  TwinSystem,
} from "../types/dartwin";

const WHITESPACE_ONLY_LINE = /^\s*$/;

const sanitizeName = (value: string) => value.trim();

const normalizeWhitespace = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !WHITESPACE_ONLY_LINE.test(line))
    .join(" ")
    .trim();

interface ExtractedBlock {
  body: string;
  end: number;
}

const extractBlock = (src: string, openIdx: number): ExtractedBlock => {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const char = src[i];
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return { body: src.slice(openIdx + 1, i), end: i };
      }
    }
  }

  return { body: "", end: src.length };
};

const parsePorts = (body: string): string[] => {
  const ports: string[] = [];
  const portRegex = /port\s+([\w-]+)\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = portRegex.exec(body))) {
    ports.push(sanitizeName(match[1]));
  }
  return ports;
};

const parseDigitalTwins = (body: string): TwinSystem["digital_twins"] => {
  const digitalTwins: TwinSystem["digital_twins"] = [];
  const dtRegex = /#digitaltwin\s+([\w-]+)\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = dtRegex.exec(body))) {
    const name = sanitizeName(match[1]);
    const openIdx = body.indexOf("{", match.index + match[0].length - 1);
    const { body: dtBody, end } = extractBlock(body, openIdx);
    digitalTwins.push({ name, ports: parsePorts(dtBody) });
    dtRegex.lastIndex = end + 1;
  }
  return digitalTwins;
};

const parseOriginalTwins = (body: string): TwinSystem["original_twins"] => {
  const originalTwins: TwinSystem["original_twins"] = [];
  const partRegex = /part\s+([\w-]+)\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = partRegex.exec(body))) {
    const name = sanitizeName(match[1]);
    const openIdx = body.indexOf("{", match.index + match[0].length - 1);
    const { body: partBody, end } = extractBlock(body, openIdx);
    originalTwins.push({ name, ports: parsePorts(partBody) });
    partRegex.lastIndex = end + 1;
  }
  return originalTwins;
};

const parseConnectionName = (inline: string | undefined, trailing: string | undefined) => {
  if (inline) {
    return sanitizeName(inline);
  }
  if (!trailing) {
    return undefined;
  }
  const commentMatch = /\/\/\s*name\s*:\s*([\w-]+)/i.exec(trailing);
  return commentMatch ? sanitizeName(commentMatch[1]) : undefined;
};

const parseConnections = (body: string): Connection[] => {
  const connections: Connection[] = [];
  const connectRegex =
    /connect\s+([\w.]+)\s+to\s+([\w.]+)(?:\s+name\s+([\w-]+))?\s*;([^\n]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = connectRegex.exec(body))) {
    const [, from, to, inlineName, trailing] = match;
    const name = parseConnectionName(inlineName, trailing);
    connections.push({
      from: sanitizeName(from),
      to: sanitizeName(to),
      ...(name ? { name } : {}),
    });
  }
  return connections;
};

const parseTwinSystems = (body: string): TwinSystem[] => {
  const systems: TwinSystem[] = [];
  const systemRegex = /#twinsystem\s+([\w-]+)\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = systemRegex.exec(body))) {
    const name = sanitizeName(match[1]);
    const openIdx = body.indexOf("{", match.index + match[0].length - 1);
    const { body: systemBody, end } = extractBlock(body, openIdx);
    systems.push({
      name,
      digital_twins: parseDigitalTwins(systemBody),
      original_twins: parseOriginalTwins(systemBody),
      connections: parseConnections(systemBody),
    });
    systemRegex.lastIndex = end + 1;
  }
  return systems;
};

const parseGoals = (body: string): Goal[] => {
  const goals: Goal[] = [];
  const goalRegex = /#goal\s+([\w-]+)\s*(\{)?/gi;
  let match: RegExpExecArray | null;
  while ((match = goalRegex.exec(body))) {
    const name = sanitizeName(match[1]);
    let doc: string | undefined;
    const hasBlock = match[2] === "{";
    if (hasBlock) {
      const openIdx = body.indexOf("{", match.index + match[0].length - 1);
      const { body: goalBody, end } = extractBlock(body, openIdx);
      const docMatch = /doc\s*\/\*([\s\S]*?)\*\//i.exec(goalBody);
      if (docMatch) {
        doc = normalizeWhitespace(docMatch[1]);
      }
      goalRegex.lastIndex = end + 1;
    }
    goals.push({ name, ...(doc ? { doc } : {}) });
  }
  return goals;
};

const parseAllocations = (body: string): Allocation[] => {
  const allocations: Allocation[] = [];
  const allocRegex = /allocate\s+([\w-]+)\s+to\s+([\w.-]+)\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = allocRegex.exec(body))) {
    allocations.push({ goal: sanitizeName(match[1]), target: sanitizeName(match[2]) });
  }
  return allocations;
};

const buildSlice = (body: string): PartialDarTwinSlice => {
  const slice: PartialDarTwinSlice = {};
  const systems = parseTwinSystems(body);
  const goals = parseGoals(body);
  const allocations = parseAllocations(body);

  if (systems.length > 0) {
    slice.systems = systems;
  }
  if (goals.length > 0) {
    slice.goals = goals;
  }
  if (allocations.length > 0) {
    slice.allocations = allocations;
  }

  return slice;
};

const parseDarTrans = (body: string): DarTrans | undefined => {
  const transRegex = /#dartrans\s*\{/i;
  const match = transRegex.exec(body);
  if (!match) {
    return undefined;
  }

  const openIdx = body.indexOf("{", match.index + match[0].length - 1);
  const { body: darTransBody } = extractBlock(body, openIdx);
  const dartrans: DarTrans = {};

  ("core before after".split(" ") as Array<keyof DarTrans>).forEach((section) => {
    const sectionRegex = new RegExp(`#${section}\\s*\\{`, "i");
    const sectionMatch = sectionRegex.exec(darTransBody);
    if (!sectionMatch) {
      return;
    }
    const sectionOpenIdx = darTransBody.indexOf("{", sectionMatch.index + sectionMatch[0].length - 1);
    const { body: sectionBody } = extractBlock(darTransBody, sectionOpenIdx);
    const slice = buildSlice(sectionBody);
    dartrans[section] = slice;
  });

  return Object.keys(dartrans).length > 0 ? dartrans : undefined;
};

const createEmptyModel = (): DarTwinModel => ({
  type: "DarTwin",
  name: "",
  systems: [],
  goals: [],
  allocations: [],
});

export function parseDarTwin(text: string): DarTwinModel {
  const headerRegex = /#dartwin\s+([\w-]+)\s*\{/i;
  const match = headerRegex.exec(text);
  if (!match) {
    return createEmptyModel();
  }

  const name = sanitizeName(match[1]);
  const openIdx = text.indexOf("{", match.index + match[0].length - 1);
  const { body } = extractBlock(text, openIdx);

  const systems = parseTwinSystems(body);
  const goals = parseGoals(body);
  const allocations = parseAllocations(body);
  const dartrans = parseDarTrans(body);

  const model: DarTwinModel = {
    type: "DarTwin",
    name,
    systems,
    goals,
    allocations,
  };

  if (dartrans) {
    model.dartrans = dartrans;
  }

  return model;
}
