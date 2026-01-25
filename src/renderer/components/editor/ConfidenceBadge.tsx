import { cn } from '../../lib/utils';

interface ConfidenceBadgeProps {
  value: number;
  threshold?: number;
  showPercentage?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  value,
  threshold = 0.7,
  showPercentage = true,
  className,
}: ConfidenceBadgeProps) {
  const isLow = value < threshold;
  const percentage = Math.round(value * 100);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border',
        isLow
          ? 'bg-warning/20 text-warning border-warning'
          : 'bg-primary/20 text-primary border-primary',
        className
      )}
      title={
        isLow
          ? 'Low confidence - AI was uncertain about this value'
          : 'High confidence'
      }
    >
      {showPercentage && `${percentage}%`}
      {isLow && <span className="ml-1">!</span>}
    </span>
  );
}
