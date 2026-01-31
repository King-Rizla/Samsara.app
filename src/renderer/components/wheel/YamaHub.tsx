import { Eye } from "lucide-react";
import { INNER_RADIUS } from "./types";

export function YamaHub() {
  const r = INNER_RADIUS;

  return (
    <g>
      {/* Decorative inner rings */}
      <circle cx={0} cy={0} r={r} fill="hsl(0, 0%, 8%)" />
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="none"
        stroke="hsl(0, 0%, 25%)"
        strokeWidth={1}
      />
      <circle
        cx={0}
        cy={0}
        r={r - 10}
        fill="none"
        stroke="hsl(0, 0%, 18%)"
        strokeWidth={0.5}
        opacity={0.5}
      />
      <circle
        cx={0}
        cy={0}
        r={r - 25}
        fill="none"
        stroke="hsl(0, 0%, 15%)"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* Eye icon + label */}
      <foreignObject
        x={-40}
        y={-35}
        width={80}
        height={70}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "white",
          }}
        >
          <div className="yama-breathe">
            <Eye size={28} style={{ color: "hsl(280, 100%, 60%)" }} />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              marginTop: 4,
              opacity: 0.7,
            }}
          >
            Yama
          </span>
          <span style={{ fontSize: 7, opacity: 0.3, marginTop: 1 }}>
            Coming Soon
          </span>
        </div>
      </foreignObject>
    </g>
  );
}
