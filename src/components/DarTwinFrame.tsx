import type { PropsWithChildren } from "react";
import "../styles/diagram.css";

interface DarTwinFrameProps {
  title: string;
}

export function DarTwinFrame({ title, children }: PropsWithChildren<DarTwinFrameProps>) {
  return (
    <div className="diagram-container">
      <div className="diagram-overlay" aria-hidden="true">
        <div className="overlay-tab">
          <span className="tab-brand">dartwin</span>
          <span className="tab-title">{title}</span>
        </div>
        <div className="overlay-divider">
          <span className="divider-marker marker-left"></span>
          <span className="divider-marker marker-right"></span>
        </div>
      </div>
      {children}
    </div>
  );
}
