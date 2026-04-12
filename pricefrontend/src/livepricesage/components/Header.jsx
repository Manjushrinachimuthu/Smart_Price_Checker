import { useState } from "react";

export default function Header() {
  const [cursorOffset, setCursorOffset] = useState({
    orb1x: 0,
    orb1y: 0,
    orb2x: 0,
    orb2y: 0,
    orb3x: 0,
    orb3y: 0
  });

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const nx = (relX - 0.5) * 2;
    const ny = (relY - 0.5) * 2;

    setCursorOffset({
      orb1x: nx * 18,
      orb1y: ny * 14,
      orb2x: nx * -14,
      orb2y: ny * -12,
      orb3x: nx * 10,
      orb3y: ny * -16
    });
  };

  const handleMouseLeave = () => {
    setCursorOffset({
      orb1x: 0,
      orb1y: 0,
      orb2x: 0,
      orb2y: 0,
      orb3x: 0,
      orb3y: 0
    });
  };

  return (
    <header      className="header"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="header-floaters" aria-hidden="true">
        <span
          className="float-orb orb-1"
          style={{ "--mx": `${cursorOffset.orb1x}px`, "--my": `${cursorOffset.orb1y}px` }}
        />
        <span
          className="float-orb orb-2"
          style={{ "--mx": `${cursorOffset.orb2x}px`, "--my": `${cursorOffset.orb2y}px` }}
        />
        <span
          className="float-orb orb-3"
          style={{ "--mx": `${cursorOffset.orb3x}px`, "--my": `${cursorOffset.orb3y}px` }}
        />
      </div>
      <p className="header-kicker">Price Intelligence Platform</p>
      <h1>
        <span
          className="header-title-main"        >
          PriceSage
        </span>
        <span
          className="header-title-sub"        >
          Live Deal Radar
        </span>
      </h1>
      <p      >
        Track your searched product across stores with a clean, visual, real-time dashboard.
      </p>
    </header>
  );
}


