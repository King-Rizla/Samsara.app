import { FileText, Briefcase, Target, Users } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { useQueueStore } from "../stores/queueStore";
import { useJDStore } from "../stores/jdStore";
import { SamsaraWheel } from "../components/wheel/SamsaraWheel";

function ProjectStatsBar() {
  const items = useQueueStore((s) => s.items);
  const jds = useJDStore((s) => s.jds);
  const matchResults = useJDStore((s) => s.matchResults);

  const completedCVs = items.filter((i) => i.status === "completed").length;
  const avgMatch =
    matchResults.length > 0
      ? Math.round(
          matchResults.reduce((sum, r) => sum + (r.match_score ?? 0), 0) /
            matchResults.length,
        )
      : null;

  const stats = [
    { label: "CVs in Project", value: items.length.toString(), icon: FileText },
    { label: "CVs Processed", value: completedCVs.toString(), icon: Users },
    {
      label: "Job Descriptions",
      value: jds.length.toString(),
      icon: Briefcase,
    },
    {
      label: "Avg Match",
      value: avgMatch !== null ? `${avgMatch}%` : "--",
      icon: Target,
    },
  ];

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex-1 bg-card border-border">
          <CardContent className="flex items-center gap-3 p-3">
            <stat.icon className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProjectView() {
  return (
    <div className="flex flex-col h-full">
      <ProjectStatsBar />
      <SamsaraWheel />
    </div>
  );
}
