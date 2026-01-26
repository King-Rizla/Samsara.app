import { useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useJDStore } from '../../stores/jdStore';
import { useQueueStore } from '../../stores/queueStore';
import { useEditorStore } from '../../stores/editorStore';
import { getMatchQuality } from '../../lib/matchingEngine';

/**
 * MatchResults displays ranked CV results against the active JD.
 *
 * CV Selection Workflow (M-01b):
 * 1. User clicks checkboxes next to CVs in Queue panel (left side)
 * 2. Selected CV IDs are stored in queueStore.selectedIds (a Set)
 * 3. This component reads selectedIds via useQueueStore
 * 4. "Match Selected" button passes selectedIds to jdStore.matchCVs()
 * 5. After matching, clearSelection() clears the checkboxes
 */
export function MatchResults() {
  const { activeJD, matchResults, matchCVs, loadMatchResults } = useJDStore();

  // Read selected CVs from queueStore - these are selected via checkboxes in QueueList
  // The existing QueueList component has checkbox UI that populates selectedIds
  const { items: queueItems, selectedIds, clearSelection } = useQueueStore();

  const { loadCV } = useEditorStore();

  // Load match results when JD changes
  useEffect(() => {
    if (activeJD) {
      loadMatchResults();
    }
  }, [activeJD?.id, loadMatchResults]);

  if (!activeJD) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Select a job description to see match results.</p>
      </div>
    );
  }

  // Filter to only completed CVs (those that have been successfully parsed)
  const completedCVs = queueItems.filter(i => i.status === 'completed');

  // Get the intersection of selectedIds and completedCVs
  // selectedIds comes from checkboxes in QueueList component
  const selectedCVIds = [...selectedIds].filter(id =>
    completedCVs.some(cv => cv.id === id)
  );

  // Match selected CVs - uses IDs from queue checkboxes
  const handleMatchSelected = async () => {
    if (selectedCVIds.length === 0) return;
    await matchCVs(selectedCVIds);
    clearSelection();  // Clear queue checkboxes after matching
  };

  // Match all completed CVs
  const handleMatchAll = async () => {
    const allIds = completedCVs.map(cv => cv.id);
    await matchCVs(allIds);
  };

  // Get CV file name from queue items
  const getCVFileName = (cvId: string) => {
    const item = queueItems.find(i => i.id === cvId);
    return item?.fileName || 'Unknown CV';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with JD info */}
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-foreground">{activeJD.title}</h3>
        {activeJD.company && (
          <p className="text-sm text-muted-foreground">{activeJD.company}</p>
        )}
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">
            {activeJD.required_skills.length} required
          </Badge>
          <Badge variant="outline">
            {activeJD.preferred_skills.length} preferred
          </Badge>
        </div>
      </div>

      {/* Match actions - explains the CV selection workflow */}
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMatchSelected}
            disabled={selectedCVIds.length === 0}
          >
            Match Selected ({selectedCVIds.length})
          </Button>
          <Button
            size="sm"
            onClick={handleMatchAll}
            disabled={completedCVs.length === 0}
          >
            Match All CVs ({completedCVs.length})
          </Button>
        </div>
        {/* Explicit user guidance for M-01b workflow */}
        <p className="text-xs text-muted-foreground">
          To match specific CVs: Use the checkboxes in the Queue panel (left) to select CVs, then click "Match Selected".
        </p>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-2">
        {matchResults.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No match results yet.</p>
            <p className="text-sm mt-1">Match CVs against this JD to see rankings.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matchResults.map((result, index) => {
              const quality = getMatchQuality(result.match_score);
              return (
                <div
                  key={result.cv_id}
                  className="p-3 rounded-md border border-border hover:border-muted-foreground
                             cursor-pointer transition-colors"
                  onClick={() => loadCV(result.cv_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-foreground truncate">
                        {getCVFileName(result.cv_id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`
                          text-lg font-bold
                          ${quality.color === 'green' ? 'text-green-500' : ''}
                          ${quality.color === 'yellow' ? 'text-yellow-500' : ''}
                          ${quality.color === 'orange' ? 'text-orange-500' : ''}
                          ${quality.color === 'red' ? 'text-red-500' : ''}
                        `}
                      >
                        {result.match_score}%
                      </span>
                      <Badge
                        variant="outline"
                        className={`
                          ${quality.color === 'green' ? 'border-green-500 text-green-500' : ''}
                          ${quality.color === 'yellow' ? 'border-yellow-500 text-yellow-500' : ''}
                          ${quality.color === 'orange' ? 'border-orange-500 text-orange-500' : ''}
                          ${quality.color === 'red' ? 'border-red-500 text-red-500' : ''}
                        `}
                      >
                        {quality.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="text-green-500">
                      {result.matched_skills.length} matched
                    </span>
                    {result.missing_required.length > 0 && (
                      <span className="ml-2 text-red-500">
                        {result.missing_required.length} required missing
                      </span>
                    )}
                  </div>

                  {/* Show matched skills preview */}
                  {result.matched_skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.matched_skills.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {result.matched_skills.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{result.matched_skills.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
