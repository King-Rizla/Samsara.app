/**
 * CandidateCard - Draggable candidate card for Kanban board
 *
 * Features:
 * - Draggable using @dnd-kit
 * - Shows name, match %, last message snippet
 * - Contact icons (phone/email)
 * - Contextual action menu
 * - Click to open detail panel
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Phone,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  PhoneCall,
  MessageSquare,
  Archive,
  Forward,
} from "lucide-react";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import {
  useWorkflowStore,
  type WorkflowCandidate,
} from "../../stores/workflowStore";
import { cn } from "../../lib/utils";

interface CandidateCardProps {
  candidate: WorkflowCandidate;
  isDragging?: boolean;
}

// Get match score color
function getMatchScoreColor(score: number): string {
  if (score >= 80) return "bg-green-500/20 text-green-500 border-green-500/50";
  if (score >= 60)
    return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
  return "bg-red-500/20 text-red-500 border-red-500/50";
}

// Format relative time
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Get valid actions for current status
function getValidActions(status: string): Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: "destructive";
}> {
  const actions: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    variant?: "destructive";
  }> = [];

  switch (status) {
    case "contacted":
      actions.push({ id: "pause", label: "Pause", icon: Pause });
      actions.push({
        id: "skipToScreening",
        label: "Skip to Screening",
        icon: Forward,
      });
      actions.push({
        id: "cancel",
        label: "Archive",
        icon: Archive,
        variant: "destructive",
      });
      break;
    case "paused":
      actions.push({ id: "resume", label: "Resume", icon: Play });
      actions.push({ id: "forceCall", label: "Force Call", icon: PhoneCall });
      actions.push({
        id: "cancel",
        label: "Archive",
        icon: Archive,
        variant: "destructive",
      });
      break;
    case "replied":
      actions.push({
        id: "skipToScreening",
        label: "Skip to Screening",
        icon: Forward,
      });
      actions.push({ id: "pause", label: "Pause", icon: Pause });
      actions.push({
        id: "cancel",
        label: "Archive",
        icon: Archive,
        variant: "destructive",
      });
      break;
    case "screening":
      actions.push({ id: "pause", label: "Pause", icon: Pause });
      actions.push({
        id: "cancel",
        label: "Archive",
        icon: Archive,
        variant: "destructive",
      });
      break;
    // passed, failed, archived - no actions available
  }

  return actions;
}

export function CandidateCard({ candidate, isDragging }: CandidateCardProps) {
  const selectCandidate = useWorkflowStore((state) => state.selectCandidate);
  const pauseWorkflow = useWorkflowStore((state) => state.pauseWorkflow);
  const resumeWorkflow = useWorkflowStore((state) => state.resumeWorkflow);
  const cancelWorkflow = useWorkflowStore((state) => state.cancelWorkflow);
  const forceCall = useWorkflowStore((state) => state.forceCall);
  const skipToScreening = useWorkflowStore((state) => state.skipToScreening);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const validActions = getValidActions(candidate.status);

  // Handle action click
  const handleAction = async (actionId: string) => {
    switch (actionId) {
      case "pause":
        await pauseWorkflow(candidate.id);
        break;
      case "resume":
        await resumeWorkflow(candidate.id);
        break;
      case "cancel":
        await cancelWorkflow(candidate.id);
        break;
      case "forceCall":
        await forceCall(candidate.id);
        break;
      case "skipToScreening":
        await skipToScreening(candidate.id);
        break;
    }
  };

  // Handle card click (but not on action menu)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on dropdown or its descendants
    if ((e.target as HTMLElement).closest("[data-dropdown-trigger]")) {
      return;
    }
    selectCandidate(candidate.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-grab",
        (isDragging || isSortableDragging) && "opacity-50 ring-2 ring-primary",
        candidate.status === "paused" && "border-amber-500/50",
      )}
    >
      {/* Header: Name and Match Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {candidate.name}
          </p>

          {/* Status badge for paused */}
          {candidate.status === "paused" && (
            <Badge
              variant="outline"
              className="mt-1 text-xs border-amber-500/50 text-amber-500"
            >
              Paused
            </Badge>
          )}
        </div>

        {/* Match score badge */}
        <Badge
          variant="outline"
          className={cn(
            "flex-shrink-0 font-bold",
            getMatchScoreColor(candidate.matchScore),
          )}
        >
          {candidate.matchScore}%
        </Badge>
      </div>

      {/* Last message snippet */}
      {candidate.lastMessageSnippet && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {candidate.lastMessageSnippet}
        </p>
      )}

      {/* Footer: Contact icons, time, and actions */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Contact icons */}
          <div className="flex items-center gap-1">
            {candidate.phone && (
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {candidate.email && (
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          {/* Last activity time */}
          {candidate.lastMessageAt && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(candidate.lastMessageAt)}
            </span>
          )}
        </div>

        {/* Action menu */}
        {validActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-dropdown-trigger
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Send message action (always available) */}
              <DropdownMenuItem onClick={() => selectCandidate(candidate.id)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>

              {validActions.length > 0 && <DropdownMenuSeparator />}

              {validActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className={
                    action.variant === "destructive"
                      ? "text-destructive"
                      : undefined
                  }
                >
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
