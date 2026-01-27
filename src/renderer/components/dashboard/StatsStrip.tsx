import { Card, CardContent } from '../ui/card';
import { FileText, Briefcase, Clock } from 'lucide-react';

interface StatsStripProps {
  totalCVs: number;
  totalJDs: number;
  timeSaved: string;
}

export function StatsStrip({ totalCVs, totalJDs, timeSaved }: StatsStripProps) {
  const stats = [
    { label: 'CVs Processed', value: totalCVs, icon: FileText },
    { label: 'Job Descriptions', value: totalJDs, icon: Briefcase },
    { label: 'Time Saved', value: timeSaved, icon: Clock },
  ];

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
