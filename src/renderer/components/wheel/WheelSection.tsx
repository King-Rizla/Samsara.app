import { motion } from "motion/react";
import { type WheelSectionDef, getWedgePath, getWedgeCentroid } from "./types";

interface WheelSectionProps {
  section: WheelSectionDef;
  index: number;
  onClick: () => void;
  onHover: (section: WheelSectionDef | null, event?: React.MouseEvent) => void;
}

export function WheelSection({
  section,
  index,
  onClick,
  onHover,
}: WheelSectionProps) {
  const path = getWedgePath(index);
  const centroid = getWedgeCentroid(index);
  const Icon = section.icon;

  // foreignObject dimensions and positioning
  const foWidth = 90;
  const foHeight = 70;

  return (
    <motion.g
      style={{ cursor: "pointer" }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      onMouseEnter={(e) => onHover(section, e as unknown as React.MouseEvent)}
      onMouseMove={(e) => onHover(section, e as unknown as React.MouseEvent)}
      onMouseLeave={() => onHover(null)}
    >
      <motion.path
        d={path}
        fill={section.color}
        fillOpacity={0.15}
        stroke={section.color}
        strokeWidth={1.5}
        strokeOpacity={0.6}
        whileHover={{ fillOpacity: 0.3, strokeOpacity: 1 }}
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
          <Icon size={24} style={{ color: section.color, marginBottom: 4 }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              textAlign: "center",
              lineHeight: 1.2,
              opacity: 0.9,
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
