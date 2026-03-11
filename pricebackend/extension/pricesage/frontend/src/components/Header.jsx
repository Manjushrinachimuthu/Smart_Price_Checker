import { motion } from "framer-motion";
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
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="header"
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
        <motion.span
          className="header-title-main"
          animate={{ backgroundPositionX: ["0%", "100%", "0%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          PriceSage
        </motion.span>
        <motion.span
          className="header-title-sub"
          animate={{ y: [0, -2, 0], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          Live Deal Radar
        </motion.span>
      </h1>
      <motion.p
        animate={{ y: [0, -1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        Track your searched product across stores with a clean, visual, real-time dashboard.
      </motion.p>
    </motion.header>
  );
}
