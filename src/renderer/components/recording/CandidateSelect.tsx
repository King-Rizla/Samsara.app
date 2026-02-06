/**
 * CandidateSelect - Dropdown to select a graduated candidate for recording attachment
 *
 * Shows a searchable list of graduated candidates (outreach_status IS NOT NULL).
 * Used in RecordingPanel when a recording is stopped and ready to attach.
 */
import { useState, useMemo } from "react";
import { Search, User, Check } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { useQueueStore } from "../../stores/queueStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";

interface CandidateSelectProps {
  onSelect: (candidateId: string, projectId: string) => void;
  disabled?: boolean;
}

export function CandidateSelect({ onSelect, disabled }: CandidateSelectProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get current project
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  // Get all queue items (CVs)
  const items = useQueueStore((state) => state.items);

  // Filter to graduated candidates with search
  const graduatedCandidates = useMemo(() => {
    return items
      .filter((item) => {
        // Must be graduated
        if (item.outreachStatus !== "graduated") return false;

        // Must have data with contact info
        if (!item.data?.contact?.name) return false;

        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          const name = item.data.contact.name.toLowerCase();
          return name.includes(searchLower);
        }

        return true;
      })
      .map((item) => ({
        id: item.id,
        name: item.data?.contact?.name || "Unknown",
        email: item.data?.contact?.email,
        phone: item.data?.contact?.phone,
        parseConfidence: item.parseConfidence,
      }));
  }, [items, search]);

  // Handle selection
  const handleSelect = (candidateId: string) => {
    setSelectedId(candidateId);
  };

  // Handle attach
  const handleAttach = () => {
    if (!selectedId || !activeProjectId) return;
    onSelect(selectedId, activeProjectId);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Attach to Candidate</div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          disabled={disabled}
        />
      </div>

      {/* Candidate list */}
      <ScrollArea className="h-32 rounded border border-border">
        {graduatedCandidates.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {search ? "No matching candidates" : "No graduated candidates"}
          </div>
        ) : (
          <div className="p-1">
            {graduatedCandidates.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => handleSelect(candidate.id)}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded text-left text-sm",
                  "hover:bg-muted/50 transition-colors",
                  selectedId === candidate.id &&
                    "bg-primary/10 border border-primary/30",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{candidate.name}</div>
                  {candidate.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {candidate.email}
                    </div>
                  )}
                </div>
                {selectedId === candidate.id && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Attach button */}
      <Button
        onClick={handleAttach}
        disabled={disabled || !selectedId || !activeProjectId}
        className="w-full"
      >
        <Check className="h-4 w-4 mr-2" />
        Attach Recording
      </Button>

      {!activeProjectId && (
        <p className="text-xs text-muted-foreground text-center">
          Select a project first
        </p>
      )}
    </div>
  );
}
