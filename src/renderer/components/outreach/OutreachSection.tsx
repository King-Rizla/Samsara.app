/**
 * OutreachSection - Main component for the Outreach wheel wedge
 *
 * Layout:
 * - Left panel: List of candidates in outreach pipeline
 * - Right panel: Selected candidate's timeline + actions
 *
 * Features:
 * - Shows candidates with contact info (graduated to outreach)
 * - Candidate list with name, status badge, StatusWheel, last message time
 * - Selected candidate panel with timeline and action buttons
 * - DNC management (add/remove from list)
 * - Delivery polling starts on mount, stops on unmount
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  MessageSquare,
  Mail,
  Phone,
  User,
  Ban,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { SectionHeader } from "../sections/SectionHeader";
import { StatusWheel } from "./StatusWheel";
import { CandidateTimeline } from "./CandidateTimeline";
import { SendMessageDialog } from "./SendMessageDialog";
import { useOutreachStore } from "../../stores/outreachStore";
import { useQueueStore } from "../../stores/queueStore";
import { useProjectStore } from "../../stores/projectStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { cn } from "../../lib/utils";
import type { OutreachCandidate } from "../../types/communication";

export function OutreachSection() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDNCDialog, setShowDNCDialog] = useState(false);
  const [dncTarget, setDncTarget] = useState<{
    type: "phone" | "email";
    value: string;
  } | null>(null);

  // Stores
  const queueItems = useQueueStore((state) => state.items);
  const { projects } = useProjectStore();
  const recruiterSettings = useSettingsStore(
    (state) => state.recruiterSettings,
  );

  const {
    candidates,
    setCandidates,
    selectedCandidateId,
    selectCandidate,
    messages,
    isLoadingMessages,
    loadMessagesForCandidate,
    loadDNCList,
    dncList,
    addToDNC,
    checkDNC,
  } = useOutreachStore();

  // Get current project
  const currentProject = projects.find((p) => p.id === projectId);

  // Build candidates from completed CVs with contact info
  useEffect(() => {
    const completedCVs = queueItems.filter(
      (item) => item.status === "completed" && item.data,
    );

    // Build candidate list from CVs with email or phone
    const candidateList: OutreachCandidate[] = completedCVs
      .filter((cv) => {
        const contact = cv.data?.contact || {};
        return contact.email || contact.phone;
      })
      .map((cv) => {
        const contact = cv.data?.contact || {};
        return {
          cvId: cv.id,
          name: contact.name || cv.fileName || "Unknown",
          email: contact.email,
          phone: contact.phone,
          messageCount: 0, // Will be populated from messages
          status: "pending" as const,
        };
      });

    setCandidates(candidateList);
  }, [queueItems, setCandidates]);

  // Load DNC list on mount
  useEffect(() => {
    loadDNCList();
  }, [loadDNCList]);

  // Load messages when candidate selected
  useEffect(() => {
    if (selectedCandidateId) {
      loadMessagesForCandidate(selectedCandidateId);
    }
  }, [selectedCandidateId, loadMessagesForCandidate]);

  // Start delivery polling on mount
  useEffect(() => {
    if (projectId) {
      window.api.startDeliveryPolling(projectId);
    }
    return () => {
      window.api.stopDeliveryPolling();
    };
  }, [projectId]);

  // Filter candidates by search
  const filteredCandidates = useMemo(() => {
    if (!searchQuery) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }, [candidates, searchQuery]);

  // Get selected candidate
  const selectedCandidate = candidates.find(
    (c) => c.cvId === selectedCandidateId,
  );

  // Check if candidate is on DNC
  const [candidateDNCStatus, setCandidateDNCStatus] = useState<{
    phone: boolean;
    email: boolean;
  }>({ phone: false, email: false });

  useEffect(() => {
    async function checkStatus() {
      if (!selectedCandidate) {
        setCandidateDNCStatus({ phone: false, email: false });
        return;
      }

      const [phoneOnDNC, emailOnDNC] = await Promise.all([
        selectedCandidate.phone
          ? checkDNC("phone", selectedCandidate.phone)
          : Promise.resolve(false),
        selectedCandidate.email
          ? checkDNC("email", selectedCandidate.email)
          : Promise.resolve(false),
      ]);

      setCandidateDNCStatus({ phone: phoneOnDNC, email: emailOnDNC });
    }
    checkStatus();
  }, [selectedCandidate, checkDNC, dncList]);

  // Count messages by type for StatusWheel
  const messageCounts = useMemo(() => {
    const smsCount = messages.filter((m) => m.type === "sms").length;
    const emailCount = messages.filter((m) => m.type === "email").length;
    return { smsCount, emailCount };
  }, [messages]);

  // Handle adding to DNC
  const handleAddToDNC = async () => {
    if (!dncTarget) return;
    await addToDNC(dncTarget.type, dncTarget.value, "manual");
    setShowDNCDialog(false);
    setDncTarget(null);
  };

  return (
    <div className="flex flex-col h-full">
      <SectionHeader title="Candidate Outreach" />

      <div className="flex-1 flex min-h-0">
        {/* Left panel - Candidate list */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Candidate list */}
          <div className="flex-1 overflow-y-auto">
            {filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">
                  {candidates.length === 0
                    ? "No candidates with contact info"
                    : "No candidates match your search"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Import CVs with email or phone to start outreach
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredCandidates.map((candidate) => (
                  <CandidateListItem
                    key={candidate.cvId}
                    candidate={candidate}
                    isSelected={selectedCandidateId === candidate.cvId}
                    onSelect={() => selectCandidate(candidate.cvId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stats footer */}
          <div className="p-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}{" "}
              in pipeline
            </p>
          </div>
        </div>

        {/* Right panel - Selected candidate */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedCandidate ? (
            <>
              {/* Candidate header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedCandidate.name}
                    </h2>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                      {selectedCandidate.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {selectedCandidate.email}
                          {candidateDNCStatus.email && (
                            <Badge
                              variant="destructive"
                              className="ml-1 text-xs"
                            >
                              DNC
                            </Badge>
                          )}
                        </span>
                      )}
                      {selectedCandidate.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {selectedCandidate.phone}
                          {candidateDNCStatus.phone && (
                            <Badge
                              variant="destructive"
                              className="ml-1 text-xs"
                            >
                              DNC
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusWheel
                    smsCount={messageCounts.smsCount}
                    emailCount={messageCounts.emailCount}
                    size={32}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => setShowSendDialog(true)}
                    disabled={
                      !selectedCandidate.phone && !selectedCandidate.email
                    }
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Send Message
                  </Button>

                  {/* Add to DNC dropdown */}
                  {(selectedCandidate.phone || selectedCandidate.email) && (
                    <div className="flex gap-1">
                      {selectedCandidate.phone && !candidateDNCStatus.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedCandidate.phone) {
                              setDncTarget({
                                type: "phone",
                                value: selectedCandidate.phone,
                              });
                              setShowDNCDialog(true);
                            }
                          }}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          DNC Phone
                        </Button>
                      )}
                      {selectedCandidate.email && !candidateDNCStatus.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedCandidate.email) {
                              setDncTarget({
                                type: "email",
                                value: selectedCandidate.email,
                              });
                              setShowDNCDialog(true);
                            }
                          }}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          DNC Email
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Message timeline */}
              <div className="flex-1 overflow-y-auto p-4">
                <CandidateTimeline
                  messages={messages}
                  isLoading={isLoadingMessages}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <MessageSquare className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <p className="text-foreground/70">
                Select a candidate to view their message history
              </p>
              <p className="text-sm text-foreground/50 mt-1">
                Send SMS or email messages and track delivery status
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Send message dialog */}
      <SendMessageDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        candidate={selectedCandidate || null}
        projectId={projectId || ""}
        roleTitle={currentProject?.name}
        companyName={currentProject?.client_name || undefined}
        recruiterName={recruiterSettings?.name}
        recruiterEmail={recruiterSettings?.email}
        recruiterPhone={recruiterSettings?.phone}
      />

      {/* Add to DNC confirmation */}
      <AlertDialog open={showDNCDialog} onOpenChange={setShowDNCDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Add to Do Not Contact List?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent sending any{" "}
              {dncTarget?.type === "phone" ? "SMS messages" : "emails"} to{" "}
              <strong>{dncTarget?.value}</strong>. This action can be undone
              from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddToDNC}>
              Add to DNC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Candidate list item component
interface CandidateListItemProps {
  candidate: OutreachCandidate;
  isSelected: boolean;
  onSelect: () => void;
}

function CandidateListItem({
  candidate,
  isSelected,
  onSelect,
}: CandidateListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-3 text-left transition-colors",
        isSelected ? "bg-accent" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{candidate.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {candidate.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{candidate.email}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {candidate.messageCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {candidate.messageCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
