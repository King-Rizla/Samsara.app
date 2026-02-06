/**
 * WaveformMeter - Visual audio level indicator
 *
 * Shows a horizontal bar that fills based on audio level (0-1).
 * Color changes from green (low) to yellow (medium) to red (high).
 */
import { cn } from "../../lib/utils";

interface WaveformMeterProps {
  level: number; // 0-1 normalized level
  className?: string;
}

export function WaveformMeter({ level, className }: WaveformMeterProps) {
  // Normalize and clamp level
  const normalizedLevel = Math.min(1, Math.max(0, level));
  const percentage = normalizedLevel * 100;

  // Color based on level
  const getColor = () => {
    if (normalizedLevel > 0.8) return "bg-red-500";
    if (normalizedLevel > 0.5) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div
      className={cn("flex-1 h-4 bg-muted rounded overflow-hidden", className)}
    >
      <div
        className={cn("h-full transition-all duration-75", getColor())}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
