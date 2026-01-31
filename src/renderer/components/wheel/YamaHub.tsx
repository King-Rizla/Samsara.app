import { Eye } from "lucide-react";
import { INNER_RADIUS } from "./types";

export function YamaHub() {
  const r = INNER_RADIUS;

  return (
    <g>
      {/* Decorative inner rings - purple tones */}
      <circle cx={0} cy={0} r={r} fill="hsl(270, 15%, 6%)" />
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="none"
        stroke="hsl(280, 60%, 25%)"
        strokeWidth={1}
      />
      <circle
        cx={0}
        cy={0}
        r={r - 12}
        fill="none"
        stroke="hsl(280, 50%, 18%)"
        strokeWidth={0.5}
        opacity={0.5}
      />
      <circle
        cx={0}
        cy={0}
        r={r - 30}
        fill="none"
        stroke="hsl(280, 40%, 15%)"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* Eye icon + label */}
      <foreignObject
        x={-45}
        y={-40}
        width={90}
        height={80}
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
            <Eye size={30} style={{ color: "hsl(280, 100%, 60%)" }} />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginTop: 4,
              opacity: 0.7,
            }}
          >
            Yama
          </span>
          <span style={{ fontSize: 8, opacity: 0.3, marginTop: 1 }}>
            Coming Soon
          </span>
        </div>
      </foreignObject>
    </g>
  );
}
