import { motion } from "motion/react";
import { type WheelSectionDef, getWedgePath, getWedgeCentroid } from "./types";

interface WheelSectionProps {
  section: WheelSectionDef;
  index: number;
  hoveredIndex: number | null;
  onClick: () => void;
  onHover: (
    section: WheelSectionDef | null,
    index: number,
    event?: React.MouseEvent,
  ) => void;
}

export function WheelSection({
  section,
  index,
  hoveredIndex,
  onClick,
  onHover,
}: WheelSectionProps) {
  const path = getWedgePath(index);
  const centroid = getWedgeCentroid(index);
  const Icon = section.icon;

  const isHovered = hoveredIndex === index;
  const isOtherHovered = hoveredIndex !== null && hoveredIndex !== index;

  // foreignObject dimensions
  const foWidth = 110;
  const foHeight = 80;

  // Determine scale: hovered stays 1.0, others retreat to 0.95
  const targetScale = isOtherHovered ? 0.95 : 1.0;
  const targetFillOpacity = isHovered ? 0.35 : 0.12;
  const targetStrokeOpacity = isHovered ? 1 : 0.4;

  return (
    <motion.g
      style={{ cursor: "pointer", transformOrigin: "0 0" }}
      animate={{ scale: targetScale }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick}
      onMouseEnter={(e) =>
        onHover(section, index, e as unknown as React.MouseEvent)
      }
      onMouseMove={(e) =>
        onHover(section, index, e as unknown as React.MouseEvent)
      }
      onMouseLeave={() => onHover(null, -1)}
    >
      <motion.path
        d={path}
        fill={isHovered ? "hsl(280, 100%, 60%)" : section.color}
        animate={{
          fillOpacity: targetFillOpacity,
          strokeOpacity: targetStrokeOpacity,
        }}
        stroke={section.color}
        strokeWidth={isHovered ? 2 : 1}
        filter={isHovered ? "url(#purpleGlow)" : undefined}
        transition={{ duration: 0.2 }}
      />
      <foreignObject
        x={centroid.x - foWidth / 2}
        y={centroid.y - foHeight / 2}
        width={foWidth}
        height={foHeight}
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
          <Icon
            size={26}
            style={{
              color: isHovered ? "hsl(280, 100%, 75%)" : section.color,
              marginBottom: 4,
              filter: isHovered
                ? "drop-shadow(0 0 6px hsl(280, 100%, 60%))"
                : "none",
              transition: "color 0.2s, filter 0.2s",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.2,
              opacity: isHovered ? 1 : 0.85,
              transition: "opacity 0.2s",
            }}
          >
            {section.name}
          </span>
          {section.comingSoon && (
            <span
              style={{
                fontSize: 8,
                opacity: 0.4,
                marginTop: 2,
              }}
            >
              Coming Soon
            </span>
          )}
        </div>
      </foreignObject>
    </motion.g>
  );
}
