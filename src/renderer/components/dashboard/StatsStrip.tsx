import { Card, CardContent } from '../ui/card';
import { FileText, Briefcase, Clock, Gauge } from 'lucide-react';
import { formatTokensWithCost } from '../../stores/usageStore';

interface StatsStripProps {
  totalCVs: number;
  totalJDs: number;
  timeSaved: string;
  totalTokens?: number;
  llmMode?: 'local' | 'cloud';
}

export function StatsStrip({ totalCVs, totalJDs, timeSaved, totalTokens, llmMode = 'local' }: StatsStripProps) {
  const stats: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'CVs Processed', value: totalCVs.toString(), icon: FileText },
    { label: 'Job Descriptions', value: totalJDs.toString(), icon: Briefcase },
    { label: 'Time Saved', value: timeSaved, icon: Clock },
  ];

  // Add tokens stat if provided (per CONTEXT.md: use gauge/meter icon)
  if (totalTokens !== undefined) {
    stats.push({
      label: 'Tokens Used',
      value: formatTokensWithCost(totalTokens, llmMode),
      icon: Gauge,
    });
  }

  return (
    <div className="flex gap-4 p-4 border-b border-border">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex-1 bg-card border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <stat.icon className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
