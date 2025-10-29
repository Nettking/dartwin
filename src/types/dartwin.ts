export interface DarTwinModel {
  type: "DarTwin";
  name: string;
  systems: TwinSystem[];
  goals: Goal[];
  allocations: Allocation[];
  dartrans?: DarTrans;
}

export interface TwinSystem {
  name: string;
  digital_twins: DigitalTwin[];
  original_twins: OriginalTwin[];
  connections: Connection[];
}

export interface DigitalTwin {
  name: string;
  ports: string[];
}

export interface OriginalTwin {
  name: string;
  ports: string[];
}

export interface Connection {
  from: string;
  to: string;
  name?: string;
}

export interface Goal {
  name: string;
  doc?: string;
}

export interface Allocation {
  goal: string;
  target: string;
}

export interface DarTrans {
  core?: PartialDarTwinSlice;
  before?: PartialDarTwinSlice;
  after?: PartialDarTwinSlice;
}

export interface PartialDarTwinSlice {
  systems?: TwinSystem[];
  goals?: Goal[];
  allocations?: Allocation[];
}

type Guarded<T> = (value: unknown) => value is T;

const isObject: Guarded<Record<string, unknown>> = (value): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isDigitalTwin: Guarded<DigitalTwin> = (value): value is DigitalTwin =>
  isObject(value) && typeof value.name === "string" && isStringArray(value.ports);

const isOriginalTwin: Guarded<OriginalTwin> = (value): value is OriginalTwin =>
  isObject(value) && typeof value.name === "string" && isStringArray(value.ports);

const isConnection: Guarded<Connection> = (value): value is Connection =>
  isObject(value) && typeof value.from === "string" && typeof value.to === "string" &&
  (typeof value.name === "undefined" || typeof value.name === "string");

const isGoal: Guarded<Goal> = (value): value is Goal =>
  isObject(value) && typeof value.name === "string" &&
  (typeof value.doc === "undefined" || typeof value.doc === "string");

const isAllocation: Guarded<Allocation> = (value): value is Allocation =>
  isObject(value) && typeof value.goal === "string" && typeof value.target === "string";

const isTwinSystem: Guarded<TwinSystem> = (value): value is TwinSystem =>
  isObject(value) &&
  typeof value.name === "string" &&
  Array.isArray(value.digital_twins) && value.digital_twins.every(isDigitalTwin) &&
  Array.isArray(value.original_twins) && value.original_twins.every(isOriginalTwin) &&
  Array.isArray(value.connections) && value.connections.every(isConnection);

const isPartialSlice: Guarded<PartialDarTwinSlice> = (value): value is PartialDarTwinSlice =>
  isObject(value) &&
  (typeof value.systems === "undefined" ||
    (Array.isArray(value.systems) && value.systems.every(isTwinSystem))) &&
  (typeof value.goals === "undefined" || (Array.isArray(value.goals) && value.goals.every(isGoal))) &&
  (typeof value.allocations === "undefined" ||
    (Array.isArray(value.allocations) && value.allocations.every(isAllocation)));

const isDarTransGuard: Guarded<DarTrans> = (value): value is DarTrans =>
  isObject(value) &&
  (typeof value.core === "undefined" || isPartialSlice(value.core)) &&
  (typeof value.before === "undefined" || isPartialSlice(value.before)) &&
  (typeof value.after === "undefined" || isPartialSlice(value.after));

export const isDarTwinModel: Guarded<DarTwinModel> = (value): value is DarTwinModel =>
  isObject(value) &&
  value.type === "DarTwin" &&
  typeof value.name === "string" &&
  Array.isArray(value.systems) && value.systems.every(isTwinSystem) &&
  Array.isArray(value.goals) && value.goals.every(isGoal) &&
  Array.isArray(value.allocations) && value.allocations.every(isAllocation) &&
  (typeof value.dartrans === "undefined" || isDarTransGuard(value.dartrans));

export const isDarTrans: Guarded<DarTrans> = isDarTransGuard;
