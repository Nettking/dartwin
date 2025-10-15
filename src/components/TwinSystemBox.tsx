interface TwinSystemBoxProps {
  prefix: string;
  label: string;
}

export function TwinSystemBox({ prefix, label }: TwinSystemBoxProps) {
  return (
    <div className="twin-box">
      <span className="dartwin-header">{prefix}</span>
      <span className="twin-label">{label}</span>
    </div>
  );
}
