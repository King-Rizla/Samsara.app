/**
 * StatusWheel - Small visual progress indicator per candidate
 *
 * Shows completion through outreach sequence:
 * - Empty = no messages sent
 * - 1/3 filled = SMS sent
 * - 2/3 = email sent
 * - Full = completed outreach
 */

interface StatusWheelProps {
  smsCount: number;
  emailCount: number;
  callCount?: number;
  size?: number;
}

export function StatusWheel({
  smsCount,
  emailCount,
  callCount = 0,
  size = 24,
}: StatusWheelProps) {
  // Calculate fill based on message counts
  const hasSms = smsCount > 0;
  const hasEmail = emailCount > 0;
  const hasCall = callCount > 0;

  // Determine fill level (0-3 segments)
  const segments = [hasSms, hasEmail, hasCall].filter(Boolean).length;

  // SVG properties
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate arc lengths for each segment
  const segmentLength = circumference / 3;
  const filledLength = segments * segmentLength;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted opacity-30"
      />
      {/* Filled arc */}
      {segments > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          strokeLinecap="round"
          className={
            segments === 3
              ? "text-green-500"
              : segments === 2
                ? "text-blue-500"
                : "text-blue-400"
          }
        />
      )}
    </svg>
  );
}
