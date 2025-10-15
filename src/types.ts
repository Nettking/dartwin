export type DarTwinNodeType = "dartwin" | "twinsystem" | "dt" | "port" | "goal";

export interface DarTwinNode {
  id: string;
  type: DarTwinNodeType;
  label: string;
  parentId?: string;
  doc?: string;
}

export interface DarTwinEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}
