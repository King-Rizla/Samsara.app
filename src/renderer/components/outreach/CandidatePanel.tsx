/**
 * CandidatePanel - Side panel for detailed candidate view
 *
 * Features:
 * - Full candidate details (name, contact info, match %)
 * - Quick action buttons for workflow control
 * - Message timeline (reuses CandidateTimeline)
 * - Send message button
 */

import { useEffect, useState } from "react";
import {
  Phone,
  Mail,
  Copy,
  Pause,
  Play,
  PhoneCall,
  MessageSquare,
  Archive,
  Forward,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { CandidateTimeline } from "./CandidateTimeline";
import { SendMessageDialog } from "./SendMessageDialog";
import { CallRecordCard } from "./CallRecordCard";
import { TranscriptViewer } from "./TranscriptViewer";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useOutreachStore, type CallRecord } from "../../stores/outreachStore";
import { useProjectStore } from "../../stores/projectStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { cn } from "../../lib/utils";

interface CandidatePanelProps {
  projectId: string;
}

// Get match score color
function getMatchScoreColor(score: number): string {
  if (score >= 80) return "bg-green-500/20 text-green-500 border-green-500/50";
  if (score >= 60)
    return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
  return "bg-red-500/20 text-red-500 border-red-500/50";
}

// Get status badge styling
function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "pending":
      return { label: "Pending", className: "bg-slate-500/20 text-slate-500" };
    case "contacted":
      return { label: "Contacted", className: "bg-blue-500/20 text-blue-500" };
    case "replied":
      return {
        label: "Replied",
        className: "bg-purple-500/20 text-purple-500",
      };
    case "screening":
      return {
        label: "Screening",
        className: "bg-amber-500/20 text-amber-500",
      };
    case "passed":
      return { label: "Passed", className: "bg-green-500/20 text-green-500" };
    case "failed":
      return { label: "Failed", className: "bg-red-500/20 text-red-500" };
    case "paused":
      return { label: "Paused", className: "bg-amber-500/20 text-amber-500" };
    case "archived":
      return { label: "Archived", className: "bg-slate-500/20 text-slate-500" };
    default:
      return { label: status, className: "bg-slate-500/20 text-slate-500" };
  }
}

export function CandidatePanel({ projectId }: CandidatePanelProps) {
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Transcript viewer state (Phase 11 Plan 03)
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptData, setTranscriptData] = useState<{
    rawText: string;
    segmentsJson?: string;
    extractedData?: Record<string, unknown>;
    outcome?: "pass" | "maybe" | "fail";
    confidence?: number;
  } | null>(null);

  // Workflow store
  const selectedCandidateId = useWorkflowStore(
    (state) => state.selectedCandidateId,
  );
  const isPanelOpen = useWorkflowStore((state) => state.isPanelOpen);
  const closePanel = useWorkflowStore((state) => state.closePanel);
  const candidates = useWorkflowStore((state) => state.candidates);
  const pauseWorkflow = useWorkflowStore((state) => state.pauseWorkflow);
  const resumeWorkflow = useWorkflowStore((state) => state.resumeWorkflow);
  const cancelWorkflow = useWorkflowStore((state) => state.cancelWorkflow);
  const forceCall = useWorkflowStore((state) => state.forceCall);
  const skipToScreening = useWorkflowStore((state) => state.skipToScreening);

  // Outreach store for messages and call records
  const {
    messages,
    isLoadingMessages,
    loadMessagesForCandidate,
    callRecords,
    loadCallRecordsForCandidate,
  } = useOutreachStore();

  // Project store
  const projects = useProjectStore((state) => state.projects);
  const currentProject = projects.find((p) => p.id === projectId);

  // Settings store
  const loadRecruiterSettings = useSettingsStore(
    (state) => state.loadRecruiterSettings,
  );
  const recruiter = useSettingsStore((state) => state.recruiter);

  // Load recruiter settings on mount
  useEffect(() => {
    loadRecruiterSettings();
  }, [loadRecruiterSettings]);

  // Get selected candidate
  const candidate = candidates.find((c) => c.id === selectedCandidateId);

  // Load messages and call records when candidate changes
  useEffect(() => {
    if (selectedCandidateId) {
      loadMessagesForCandidate(selectedCandidateId);
      loadCallRecordsForCandidate(selectedCandidateId);
    }
  }, [
    selectedCandidateId,
    loadMessagesForCandidate,
    loadCallRecordsForCandidate,
  ]);

  // Copy to clipboard
  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // View transcript handler (Phase 11 Plan 03)
  const handleViewTranscript = async (callId: string, call: CallRecord) => {
    try {
      const result = await window.api.getCallTranscript(callId);
      if (result.success && result.data) {
        setTranscriptData({
          rawText: result.data.rawText,
          segmentsJson: result.data.segmentsJson,
          extractedData: call.extractedDataJson
            ? JSON.parse(call.extractedDataJson)
            : undefined,
          outcome: call.screeningOutcome,
          confidence: call.screeningConfidence,
        });
        setShowTranscript(true);
      } else {
        toast.error("Transcript not available");
      }
    } catch (error) {
      console.error("Failed to load transcript:", error);
      toast.error("Failed to load transcript");
    }
  };

  // Determine available actions based on status
  const getAvailableActions = () => {
    if (!candidate) return [];

    const actions: Array<{
      id: string;
      label: string;
      icon: React.ElementType;
      onClick: () => void;
      variant?: "destructive" | "default";
    }> = [];

    switch (candidate.status) {
      case "contacted":
        actions.push({
          id: "pause",
          label: "Pause",
          icon: Pause,
          onClick: () => pauseWorkflow(candidate.id),
        });
        actions.push({
          id: "skip",
          label: "Skip to Screening",
          icon: Forward,
          onClick: () => skipToScreening(candidate.id),
        });
        actions.push({
          id: "cancel",
          label: "Archive",
          icon: Archive,
          onClick: () => cancelWorkflow(candidate.id),
          variant: "destructive",
        });
        break;
      case "paused":
        actions.push({
          id: "resume",
          label: "Resume",
          icon: Play,
          onClick: () => resumeWorkflow(candidate.id),
        });
        actions.push({
          id: "forceCall",
          label: "Force Call",
          icon: PhoneCall,
          onClick: () => forceCall(candidate.id),
        });
        actions.push({
          id: "cancel",
          label: "Archive",
          icon: Archive,
          onClick: () => cancelWorkflow(candidate.id),
          variant: "destructive",
        });
        break;
      case "replied":
        actions.push({
          id: "skip",
          label: "Skip to Screening",
          icon: Forward,
          onClick: () => skipToScreening(candidate.id),
        });
        actions.push({
          id: "pause",
          label: "Pause",
          icon: Pause,
          onClick: () => pauseWorkflow(candidate.id),
        });
        actions.push({
          id: "cancel",
          label: "Archive",
          icon: Archive,
          onClick: () => cancelWorkflow(candidate.id),
          variant: "destructive",
        });
        break;
      case "screening":
        actions.push({
          id: "pause",
          label: "Pause",
          icon: Pause,
          onClick: () => pauseWorkflow(candidate.id),
        });
        actions.push({
          id: "cancel",
          label: "Archive",
          icon: Archive,
          onClick: () => cancelWorkflow(candidate.id),
          variant: "destructive",
        });
        break;
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  const statusBadge = candidate ? getStatusBadge(candidate.status) : null;

  return (
    <>
      <Sheet open={isPanelOpen} onOpenChange={(open) => !open && closePanel()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          {candidate ? (
            <>
              {/* Header */}
              <SheetHeader className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg truncate">
                      {candidate.name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold",
                          getMatchScoreColor(candidate.matchScore),
                        )}
                      >
                        {candidate.matchScore}%
                      </Badge>
                      {statusBadge && (
                        <Badge
                          variant="outline"
                          className={statusBadge.className}
                        >
                          {statusBadge.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Contact Info */}
              <div className="px-4 py-3 border-b border-border space-y-2">
                {candidate.phone && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{candidate.phone}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleCopy(candidate.phone!, "phone")}
                    >
                      {copiedField === "phone" ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
                {candidate.email && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{candidate.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleCopy(candidate.email!, "email")}
                    >
                      {copiedField === "email" ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex flex-wrap gap-2">
                  {/* Send Message - always available */}
                  <Button
                    size="sm"
                    onClick={() => setShowSendDialog(true)}
                    disabled={!candidate.phone && !candidate.email}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Send Message
                  </Button>

                  {/* Status-specific actions */}
                  {availableActions.map((action) => (
                    <Button
                      key={action.id}
                      size="sm"
                      variant={
                        action.variant === "destructive"
                          ? "destructive"
                          : "outline"
                      }
                      onClick={action.onClick}
                    >
                      <action.icon className="h-4 w-4 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Call Records (Phase 11 Plan 03) */}
              {callRecords.length > 0 && (
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium mb-3">Screening Calls</h3>
                  <div className="space-y-2">
                    {callRecords.map((call) => (
                      <CallRecordCard
                        key={call.id}
                        call={call}
                        onViewTranscript={() =>
                          handleViewTranscript(call.id, call)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Message Timeline */}
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-sm font-medium mb-3">Message History</h3>
                <CandidateTimeline
                  messages={messages}
                  isLoading={isLoadingMessages}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select a candidate to view details</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Send Message Dialog */}
      {candidate && (
        <SendMessageDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          candidate={{
            cvId: candidate.id,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            messageCount: 0,
            status: "pending",
          }}
          projectId={projectId}
          roleTitle={currentProject?.name}
          companyName={currentProject?.client_name || undefined}
          recruiterName={recruiter?.name}
          recruiterEmail={recruiter?.email}
          recruiterPhone={recruiter?.phone}
        />
      )}

      {/* Transcript Viewer Dialog (Phase 11 Plan 03) */}
      {transcriptData && (
        <TranscriptViewer
          open={showTranscript}
          onOpenChange={setShowTranscript}
          transcript={transcriptData.rawText}
          segments={
            transcriptData.segmentsJson
              ? JSON.parse(transcriptData.segmentsJson)
              : undefined
          }
          extractedData={
            transcriptData.extractedData as {
              salaryExpectation?: string;
              location?: string;
              availability?: string;
              interestLevel?: string;
              contactPreference?: string;
              reasoning?: string;
              disqualifiers?: string[];
            }
          }
          outcome={transcriptData.outcome}
          confidence={transcriptData.confidence}
        />
      )}
    </>
  );
}
