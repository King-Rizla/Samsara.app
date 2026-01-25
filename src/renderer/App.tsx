import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';

export function App() {
  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-primary">Samsara</h1>
        <p className="text-muted-foreground">CV Parser & Editor</p>
      </header>

      <main>
        {/* Placeholder - will be replaced with QueueTabs in Plan 03 */}
        <div className="space-y-4">
          <p className="text-foreground">Terminal aesthetic preview:</p>
          <div className="flex gap-2">
            <Button variant="outline">Outlined Button</Button>
            <Button>Primary Button</Button>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-status-submitted/20 text-status-submitted border border-status-submitted">Submitted</Badge>
            <Badge className="bg-status-completed/20 text-status-completed border border-status-completed">Completed</Badge>
            <Badge className="bg-status-failed/20 text-status-failed border border-status-failed">Failed</Badge>
          </div>
        </div>
      </main>
    </div>
  );
}
