export interface GoalNodeData {
  label: string;
  doc?: string;
}

export function GoalTrapezoid({ data }: { data: GoalNodeData }) {
  return (
    <div className="node goal">
      <div className="goal-title">{data.label}</div>
      {data.doc ? <div className="goal-doc">{data.doc}</div> : null}
    </div>
  );
}
