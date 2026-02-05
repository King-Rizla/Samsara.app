/**
 * CallRecordCard - Display screening call outcome
 *
 * Shows call status, duration, outcome badge (pass/maybe/fail),
 * and confidence score. Includes button to view full transcript.
 */

import {
  Phone,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface CallRecord {
  id: string;
  status: "in_progress" | "completed" | "failed" | "no_answer";
  durationSeconds?: number;
  screeningOutcome?: "pass" | "maybe" | "fail";
  screeningConfidence?: number;
  extractedDataJson?: string;
  startedAt: string;
  endedAt?: string;
}

interface CallRecordCardProps {
  call: CallRecord;
  onViewTranscript: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getOutcomeStyle(outcome?: string) {
  switch (outcome) {
    case "pass":
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        label: "Passed",
      };
    case "fail":
      return {
        icon: AlertCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        label: "Failed",
      };
    case "maybe":
      return {
        icon: HelpCircle,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        label: "Maybe",
      };
    default:
      return {
        icon: Phone,
        color: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-muted",
        label: "Unknown",
      };
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "no_answer":
      return "No Answer";
    default:
      return status;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// Component
// ============================================================================

export function CallRecordCard({
  call,
  onViewTranscript,
}: CallRecordCardProps) {
  const outcomeStyle = getOutcomeStyle(call.screeningOutcome);
  const OutcomeIcon = outcomeStyle.icon;
  const isCompleted = call.status === "completed";

  return (
    <Card
      className={cn(
        "transition-colors",
        isCompleted && call.screeningOutcome && outcomeStyle.bg,
        isCompleted && call.screeningOutcome && outcomeStyle.border,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Screening Call
          </CardTitle>
          {isCompleted && call.screeningOutcome ? (
            <Badge
              variant="outline"
              className={cn("font-medium", outcomeStyle.color)}
            >
              <OutcomeIcon className="h-3 w-3 mr-1" />
              {outcomeStyle.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {getStatusLabel(call.status)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {call.status === "in_progress"
              ? "In progress..."
              : `Duration: ${formatDuration(call.durationSeconds)}`}
          </div>
          {call.screeningConfidence != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Confidence: {Math.round(call.screeningConfidence)}%
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {new Date(call.startedAt).toLocaleString()}
        </div>

        {isCompleted && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewTranscript}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Transcript
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
