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
  type?: "screening" | "recruiter";
  status: "in_progress" | "completed" | "failed" | "no_answer";
  durationSeconds?: number;
  screeningOutcome?: "pass" | "maybe" | "fail";
  screeningConfidence?: number;
  extractedDataJson?: string;
  startedAt: string;
  endedAt?: string;
  transcriptionStatus?: "queued" | "processing" | "completed" | "failed";
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
  const isRecruiterCall = call.type === "recruiter";

  // Recruiter calls use teal accent, AI screening uses purple
  const callTypeStyle = isRecruiterCall
    ? {
        bg: "bg-teal-500/10",
        border: "border-teal-500/30",
        badgeColor: "text-teal-500 border-teal-500/50",
        label: "Recruiter Call",
      }
    : {
        bg: outcomeStyle.bg,
        border: outcomeStyle.border,
        badgeColor: "text-purple-500 border-purple-500/50",
        label: "AI Screening",
      };

  // Transcription status badge for recruiter calls
  const getTranscriptionBadge = () => {
    if (!isRecruiterCall) return null;

    switch (call.transcriptionStatus) {
      case "queued":
        return (
          <Badge variant="outline" className="text-amber-500 text-xs">
            Queued
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="text-blue-500 text-xs">
            Transcribing...
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-red-500 text-xs">
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      className={cn(
        "transition-colors",
        isCompleted && callTypeStyle.bg,
        isCompleted && callTypeStyle.border,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span>{isRecruiterCall ? "Recruiter Call" : "Screening Call"}</span>
            {/* Call type badge */}
            <Badge
              variant="outline"
              className={cn("text-xs", callTypeStyle.badgeColor)}
            >
              {callTypeStyle.label}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Transcription status for recruiter calls */}
            {getTranscriptionBadge()}
            {/* Outcome badge for completed calls */}
            {isCompleted && call.screeningOutcome ? (
              <Badge
                variant="outline"
                className={cn("font-medium", outcomeStyle.color)}
              >
                <OutcomeIcon className="h-3 w-3 mr-1" />
                {outcomeStyle.label}
              </Badge>
            ) : (
              !isRecruiterCall && (
                <Badge variant="outline" className="text-muted-foreground">
                  {getStatusLabel(call.status)}
                </Badge>
              )
            )}
          </div>
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

        {/* Show transcript button for completed AI calls OR recruiter calls with completed transcription */}
        {(isCompleted && !isRecruiterCall) ||
        (isRecruiterCall && call.transcriptionStatus === "completed") ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewTranscript}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Transcript
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
