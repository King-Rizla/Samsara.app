import { useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WHEEL_SECTIONS, VIEWBOX, type WheelSectionDef } from "./types";
import { WheelSection } from "./WheelSection";
import { YamaHub } from "./YamaHub";

export function SamsaraWheel() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    section: WheelSectionDef;
    x: number;
    y: number;
  } | null>(null);

  const handleHover = useCallback(
    (
      section: WheelSectionDef | null,
      index: number,
      event?: React.MouseEvent,
    ) => {
      if (!section || !event || !containerRef.current) {
        setHoveredIndex(null);
        setTooltip(null);
        return;
      }
      setHoveredIndex(index);
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({
        section,
        x: event.clientX - rect.left + 12,
        y: event.clientY - rect.top - 8,
      });
    },
    [],
  );

  const handleClick = useCallback(
    (section: WheelSectionDef) => {
      navigate(`/project/${id}/${section.route}`);
    },
    [navigate, id],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center relative"
      style={{
        background:
          "radial-gradient(circle at center, hsl(280 100% 60% / 0.06) 0%, transparent 70%)",
      }}
    >
      <svg
        viewBox={VIEWBOX}
        style={{ width: "100%", height: "100%", maxWidth: 650, maxHeight: 650 }}
      >
        {/* SVG filter for purple glow on hover */}
        <defs>
          <filter id="purpleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feFlood
              floodColor="hsl(280, 100%, 60%)"
              floodOpacity="0.6"
              result="color"
            />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Decorative outer rings (Bhavachakra-inspired) */}
        <circle
          cx={0}
          cy={0}
          r={300}
          fill="none"
          stroke="hsl(280, 60%, 30%)"
          strokeWidth={0.8}
          strokeDasharray="6 4"
          opacity={0.3}
        />
        <circle
          cx={0}
          cy={0}
          r={305}
          fill="none"
          stroke="hsl(280, 100%, 60%)"
          strokeWidth={0.5}
          strokeDasharray="2 6"
          opacity={0.15}
        />

        {/* Wedges */}
        {WHEEL_SECTIONS.map((section, i) => (
          <WheelSection
            key={section.id}
            section={section}
            index={i}
            hoveredIndex={hoveredIndex}
            onClick={() => handleClick(section)}
            onHover={handleHover}
          />
        ))}

        {/* Center hub */}
        <YamaHub />
      </svg>

      {/* HTML tooltip overlay */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "hsl(270, 20%, 8%)",
              border: "1px solid hsl(280, 60%, 30%)",
              borderRadius: 6,
              padding: "8px 12px",
              color: "white",
              fontSize: 12,
              whiteSpace: "nowrap",
              boxShadow: "0 0 12px hsl(280, 100%, 60% / 0.2)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: 4,
                color: "hsl(280, 100%, 75%)",
              }}
            >
              {tooltip.section.name}
            </div>
            {tooltip.section.stats.map((s) => (
              <div key={s.label} style={{ opacity: 0.6, fontSize: 11 }}>
                {s.label}: {s.value}
              </div>
            ))}
            {tooltip.section.comingSoon && (
              <div style={{ opacity: 0.4, fontSize: 10, marginTop: 4 }}>
                Coming Soon
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
