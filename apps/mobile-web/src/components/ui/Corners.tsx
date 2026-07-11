import React, { type CSSProperties } from "react";

const POSITIONS: { char: string; style: CSSProperties }[] = [
  { char: "┌", style: { top: 6, left: 6 } },
  { char: "┐", style: { top: 6, right: 6 } },
  { char: "└", style: { bottom: 6, left: 6 } },
  { char: "┘", style: { bottom: 6, right: 6 } },
];

// Box-drawing corner accents used on every aur-card in place of a border-radius.
export default function Corners() {
  return (
    <>
      {POSITIONS.map(({ char, style }) => (
        <span key={char} className="aur-corner" style={style}>
          {char}
        </span>
      ))}
    </>
  );
}
