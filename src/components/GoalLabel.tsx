interface GoalLabelProps {
  title: string;
  doc?: string;
}

export function GoalLabel({ title, doc }: GoalLabelProps) {
  return (
    <div className="goal-box">
      <div className="goal-title">{title}</div>
      {doc ? <div className="goal-doc">{doc}</div> : null}
    </div>
  );
}
