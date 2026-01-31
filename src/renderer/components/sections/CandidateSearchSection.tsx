import { SectionHeader } from "./SectionHeader";
import { QueueTabs } from "../queue/QueueTabs";
import { CVEditor } from "../editor/CVEditor";
import { ErrorDetailPanel } from "../editor/ErrorDetailPanel";
import { JDPanel } from "../jd/JDPanel";
import { JDDetail } from "../jd/JDDetail";
import { useEditorStore } from "../../stores/editorStore";

export function CandidateSearchSection() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const isPanelOpen = viewMode !== null;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="Candidate Search" />
      <main className="flex-1 overflow-hidden flex">
        <div
          data-testid="queue-panel"
          className={`border-r border-border min-w-0 overflow-hidden ${isPanelOpen ? "w-1/3" : "w-1/2"}`}
        >
          <QueueTabs />
        </div>

        <div
          data-testid="jd-panel"
          className={`border-r border-border min-w-0 overflow-hidden ${isPanelOpen ? "w-1/3" : "w-1/2"}`}
        >
          <JDPanel />
        </div>

        {viewMode === "cv" && (
          <div className="w-1/3 min-w-0 overflow-hidden">
            <CVEditor />
          </div>
        )}
        {viewMode === "error" && (
          <div className="w-1/3 min-w-0 overflow-hidden">
            <ErrorDetailPanel />
          </div>
        )}
        {viewMode === "jd" && (
          <div className="w-1/3 min-w-0 overflow-y-auto">
            <JDDetail />
          </div>
        )}
      </main>
    </div>
  );
}
