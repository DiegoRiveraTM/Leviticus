import { useState } from "react";
import "./IntroScreen.css";

interface Props {
  onEnter: () => void;
}

export default function IntroScreen({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 700);
  }

  return (
    <div className={`intro ${leaving ? "leaving" : ""}`} onClick={enter}>
      <div className="intro-ring" />
      <div className="intro-inner">
        <div className="intro-eyebrow"></div>
        <h1 className="intro-title">LEVITICO</h1>
        <div className="intro-shimmer" />
        <div className="intro-cta">Click To Start</div>
      </div>
      <div className="intro-footer">v0.6.0</div>
    </div>
  );
}
