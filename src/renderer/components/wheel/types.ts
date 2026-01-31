import {
  Search,
  Phone,
  Users,
  Database,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface WheelSectionDef {
  id: string;
  name: string;
  route: string;
  icon: LucideIcon;
  color: string;
  comingSoon: boolean;
  stats: { label: string; value: string }[];
}

export const WHEEL_SECTIONS: WheelSectionDef[] = [
  {
    id: "candidate-search",
    name: "Candidate Search",
    route: "search",
    icon: Search,
    color: "hsl(210, 60%, 70%)",
    comingSoon: false,
    stats: [
      { label: "Pipeline", value: "0" },
      { label: "Matched", value: "0" },
    ],
  },
  {
    id: "candidate-outreach",
    name: "Candidate Outreach",
    route: "outreach",
    icon: Phone,
    color: "hsl(160, 50%, 65%)",
    comingSoon: true,
    stats: [
      { label: "Pipeline", value: "0" },
      { label: "Response rate", value: "--" },
    ],
  },
  {
    id: "client-coordination",
    name: "Client Coordination",
    route: "coordination",
    icon: Users,
    color: "hsl(35, 60%, 70%)",
    comingSoon: true,
    stats: [
      { label: "Active clients", value: "0" },
      { label: "Interviews", value: "0" },
    ],
  },
  {
    id: "data-entry",
    name: "Data Entry",
    route: "data-entry",
    icon: Database,
    color: "hsl(180, 50%, 65%)",
    comingSoon: true,
    stats: [
      { label: "Records", value: "0" },
      { label: "Pending", value: "0" },
    ],
  },
  {
    id: "business-dev",
    name: "Business Development",
    route: "business-dev",
    icon: TrendingUp,
    color: "hsl(340, 50%, 70%)",
    comingSoon: true,
    stats: [
      { label: "Leads", value: "0" },
      { label: "Conversions", value: "--" },
    ],
  },
];

export const INNER_RADIUS = 80;
export const OUTER_RADIUS = 220;
export const VIEWBOX = "-260 -260 520 520";

const SECTION_COUNT = WHEEL_SECTIONS.length;
const ANGLE_PER_SECTION = (2 * Math.PI) / SECTION_COUNT;
const START_OFFSET = -Math.PI / 2; // start from top

/**
 * Build an SVG arc path for wedge at the given index.
 * Each wedge spans from INNER_RADIUS to OUTER_RADIUS.
 */
export function getWedgePath(index: number): string {
  const startAngle = START_OFFSET + index * ANGLE_PER_SECTION;
  const endAngle = startAngle + ANGLE_PER_SECTION;

  const ix1 = INNER_RADIUS * Math.cos(startAngle);
  const iy1 = INNER_RADIUS * Math.sin(startAngle);
  const ox1 = OUTER_RADIUS * Math.cos(startAngle);
  const oy1 = OUTER_RADIUS * Math.sin(startAngle);
  const ix2 = INNER_RADIUS * Math.cos(endAngle);
  const iy2 = INNER_RADIUS * Math.sin(endAngle);
  const ox2 = OUTER_RADIUS * Math.cos(endAngle);
  const oy2 = OUTER_RADIUS * Math.sin(endAngle);

  // Large arc flag = 0 since each wedge < 180 degrees
  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1}`,
    "Z",
  ].join(" ");
}

/**
 * Get the centroid position for a wedge (for placing icon/label).
 */
export function getWedgeCentroid(index: number): { x: number; y: number } {
  const midAngle =
    START_OFFSET + index * ANGLE_PER_SECTION + ANGLE_PER_SECTION / 2;
  const midRadius = (INNER_RADIUS + OUTER_RADIUS) / 2;
  return {
    x: midRadius * Math.cos(midAngle),
    y: midRadius * Math.sin(midAngle),
  };
}
