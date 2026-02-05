/**
 * TranscriptViewer - Display full call transcript
 *
 * Shows conversation with speaker labels and timestamps.
 * Displays extracted data and analysis reasoning.
 */

import { User, Bot, Info, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

// ============================================================================
// Types
// ============================================================================

interface TranscriptSegment {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
}

interface ExtractedData {
  salaryExpectation?: string;
  location?: string;
  availability?: string;
  interestLevel?: string;
  contactPreference?: string;
  reasoning?: string;
  disqualifiers?: string[];
}

interface TranscriptViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: string;
  segments?: TranscriptSegment[];
  extractedData?: ExtractedData;
  outcome?: "pass" | "maybe" | "fail";
  confidence?: number;
  reasoning?: string;
  disqualifiers?: string[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse raw transcript string into segments.
 */
function parseTranscript(transcript: string): TranscriptSegment[] {
  const lines = transcript.split("\n\n").filter((l) => l.trim());
  return lines.map((line) => {
    const isAgent = line.startsWith("Agent:");
    const message = line.replace(/^(Agent|Candidate):\s*/, "").trim();
    return {
      role: isAgent ? "agent" : "user",
      message,
    };
  });
}

/**
 * Format seconds to MM:SS.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// Component
// ============================================================================

export function TranscriptViewer({
  open,
  onOpenChange,
  transcript,
  segments,
  extractedData,
  outcome,
  confidence,
  reasoning,
  disqualifiers,
}: TranscriptViewerProps) {
  // Parse raw transcript if segments not provided
  const parsedSegments: TranscriptSegment[] =
    segments || parseTranscript(transcript);

  // Get reasoning and disqualifiers from extractedData if not provided directly
  const displayReasoning = reasoning || extractedData?.reasoning;
  const displayDisqualifiers =
    disqualifiers || extractedData?.disqualifiers || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Call Transcript</DialogTitle>
          <DialogDescription>
            Full conversation transcript with analysis results
          </DialogDescription>
        </DialogHeader>

        {/* Analysis Summary */}
        {outcome && (
          <div className="space-y-3 py-3 border-b">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  outcome === "pass" && "text-green-500 border-green-500/50",
                  outcome === "maybe" && "text-amber-500 border-amber-500/50",
                  outcome === "fail" && "text-red-500 border-red-500/50",
                )}
              >
                {outcome.toUpperCase()}
              </Badge>
              {confidence != null && (
                <span className="text-sm text-muted-foreground">
                  {Math.round(confidence)}% confidence
                </span>
              )}
            </div>

            {displayReasoning && (
              <div className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground">{displayReasoning}</p>
              </div>
            )}

            {displayDisqualifiers.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                <div className="space-y-1">
                  {displayDisqualifiers.map((d, i) => (
                    <p key={i} className="text-red-500">
                      {d}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extracted Data */}
        {extractedData &&
          Object.values(extractedData).some(
            (v) =>
              v &&
              v !== extractedData.reasoning &&
              v !== extractedData.disqualifiers,
          ) && (
            <div className="py-3 border-b">
              <h4 className="text-sm font-medium mb-2">
                Extracted Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {extractedData.salaryExpectation && (
                  <div>
                    <span className="text-muted-foreground">Salary:</span>{" "}
                    {extractedData.salaryExpectation}
                  </div>
                )}
                {extractedData.location && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    {extractedData.location}
                  </div>
                )}
                {extractedData.availability && (
                  <div>
                    <span className="text-muted-foreground">Availability:</span>{" "}
                    {extractedData.availability}
                  </div>
                )}
                {extractedData.interestLevel && (
                  <div>
                    <span className="text-muted-foreground">Interest:</span>{" "}
                    {extractedData.interestLevel}
                  </div>
                )}
                {extractedData.contactPreference && (
                  <div>
                    <span className="text-muted-foreground">Contact:</span>{" "}
                    {extractedData.contactPreference}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Transcript */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            {parsedSegments.map((segment, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  segment.role === "agent" ? "flex-row" : "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    segment.role === "agent" ? "bg-primary/10" : "bg-muted",
                  )}
                >
                  {segment.role === "agent" ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 rounded-lg p-3 max-w-[80%]",
                    segment.role === "agent"
                      ? "bg-primary/5 mr-auto"
                      : "bg-muted ml-auto text-right",
                  )}
                >
                  <p className="text-sm">{segment.message}</p>
                  {segment.time_in_call_secs != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(segment.time_in_call_secs)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
