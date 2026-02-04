/**
 * GraduationControls - Batch graduation controls for selected candidates
 *
 * Shows count of selected candidates and button to graduate them to outreach pipeline.
 */

import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useWorkflowStore } from "../../stores/workflowStore";

interface GraduationControlsProps {
  selectedIds: string[];
  projectId: string;
  onGraduated: () => void;
}

export function GraduationControls({
  selectedIds,
  projectId,
  onGraduated,
}: GraduationControlsProps) {
  const [isGraduating, setIsGraduating] = useState(false);
  const graduateBatch = useWorkflowStore((state) => state.graduateBatch);

  const handleGraduate = async () => {
    if (selectedIds.length === 0) return;

    setIsGraduating(true);
    try {
      const result = await graduateBatch(selectedIds, projectId);
      if (result.success.length > 0) {
        onGraduated();
      }
    } finally {
      setIsGraduating(false);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border">
      <span className="text-sm text-muted-foreground">
        {selectedIds.length} candidate{selectedIds.length !== 1 ? "s" : ""}{" "}
        selected
      </span>
      <Button
        size="sm"
        onClick={handleGraduate}
        disabled={isGraduating}
        className="ml-auto"
      >
        {isGraduating ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <GraduationCap className="h-4 w-4 mr-1" />
        )}
        Graduate Selected
      </Button>
    </div>
  );
}
