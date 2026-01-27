import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { JDInput } from './JDInput';
import { JDList } from './JDList';
import { MatchResults } from './MatchResults';
import { useJDStore } from '../../stores/jdStore';

export function JDPanel() {
  const { activeJD } = useJDStore();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="jds" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border px-4 flex-shrink-0">
          <TabsList className="bg-transparent">
            <TabsTrigger
              value="jds"
              className="data-[state=active]:bg-muted"
            >
              Job Descriptions
            </TabsTrigger>
            <TabsTrigger
              value="add"
              className="data-[state=active]:bg-muted"
            >
              Add JD
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="data-[state=active]:bg-muted"
              disabled={!activeJD}
            >
              Match Results
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jds" className="flex-1 overflow-y-auto mt-0">
          <JDList />
        </TabsContent>

        <TabsContent value="add" className="flex-1 overflow-y-auto mt-0">
          <JDInput />
        </TabsContent>

        <TabsContent value="results" className="flex-1 overflow-y-auto mt-0">
          <MatchResults />
        </TabsContent>
      </Tabs>
    </div>
  );
}
