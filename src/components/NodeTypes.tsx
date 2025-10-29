import type { NodeProps, NodeTypes } from "reactflow";

import { GoalLabel } from "./GoalLabel";
import { TwinSystemBox } from "./TwinSystemBox";

export interface BaseNodeData {
  label: string;
  parent?: string;
  kind: string;
}

export interface GoalNodeData extends BaseNodeData {
  doc?: string;
}

export interface DigitalTwinNodeData extends BaseNodeData {}

export interface PortNodeData extends BaseNodeData {
  caption?: string;
}

const GoalNode = ({ data }: NodeProps<GoalNodeData>) => (
  <GoalLabel title={data.label} doc={data.doc} />
);

const TwinSystemNode = ({ data }: NodeProps<BaseNodeData>) => (
  <TwinSystemBox prefix="twin.system" label={data.label} />
);

const DigitalTwinNode = ({ data }: NodeProps<DigitalTwinNodeData>) => (
  <TwinSystemBox prefix="digital twin" label={data.label} />
);

const HiddenNode = () => null;

const PortNode = ({ data }: NodeProps<PortNodeData>) => (
  <div className="port-node" title={data.label}>
    <div className="port-square" aria-hidden="true" />
    {data.caption ? <span className="port-caption">{data.caption}</span> : null}
  </div>
);

export const nodeTypes: NodeTypes = {
  goal: GoalNode,
  twinsystem: TwinSystemNode,
  dt: DigitalTwinNode,
  at: HiddenNode,
  port: PortNode,
};
