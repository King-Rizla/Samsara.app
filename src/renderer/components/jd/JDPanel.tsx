import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { JDInput } from './JDInput';
import { JDList } from './JDList';
import { MatchResults } from './MatchResults';
import { useJDStore } from '../../stores/jdStore';

export function JDPanel() {
  const { activeJD } = useJDStore();

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="jds" className="flex-1 flex flex-col">
        <div className="border-b border-border px-4">
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
              {activeJD && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({activeJD.title.substring(0, 15)}...)
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jds" className="flex-1 overflow-y-auto mt-0">
          <JDList />
        </TabsContent>

        <TabsContent value="add" className="flex-1 overflow-y-auto mt-0">
          <JDInput />
        </TabsContent>

        <TabsContent value="results" className="flex-1 overflow-hidden mt-0">
          <MatchResults />
        </TabsContent>
      </Tabs>
    </div>
  );
}
