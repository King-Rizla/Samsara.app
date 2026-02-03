/**
 * CandidateTimeline - Timeline view of messages sent to a candidate
 *
 * Shows:
 * - Message type icon (SMS/Email)
 * - Status badge (sent, delivered, failed)
 * - Timestamp
 * - Preview of message body
 * - Click to expand and see full message
 */

import { useState } from "react";
import {
  MessageSquare,
  Mail,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Message } from "../../types/communication";

interface CandidateTimelineProps {
  messages: Message[];
  isLoading?: boolean;
}

export function CandidateTimeline({
  messages,
  isLoading,
}: CandidateTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">
          No messages sent to this candidate yet
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Send an SMS or email to start the conversation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <TimelineItem
          key={message.id}
          message={message}
          isExpanded={expandedId === message.id}
          onToggle={() =>
            setExpandedId(expandedId === message.id ? null : message.id)
          }
        />
      ))}
    </div>
  );
}

interface TimelineItemProps {
  message: Message;
  isExpanded: boolean;
  onToggle: () => void;
}

function TimelineItem({ message, isExpanded, onToggle }: TimelineItemProps) {
  const TypeIcon = message.type === "sms" ? MessageSquare : Mail;

  const StatusIcon = {
    queued: Clock,
    sent: Check,
    delivered: CheckCheck,
    failed: AlertCircle,
    received: CheckCheck,
  }[message.status];

  const statusColor = {
    queued: "text-muted-foreground",
    sent: "text-blue-500",
    delivered: "text-green-500",
    failed: "text-destructive",
    received: "text-green-500",
  }[message.status];

  const statusBgColor = {
    queued: "bg-muted",
    sent: "bg-blue-500/10",
    delivered: "bg-green-500/10",
    failed: "bg-destructive/10",
    received: "bg-green-500/10",
  }[message.status];

  // Format timestamp
  const timestamp = message.sentAt || message.createdAt;
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unknown time";

  // Truncate body for preview
  const previewText =
    message.body.length > 80 ? message.body.slice(0, 80) + "..." : message.body;

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        message.status === "failed" ? "border-destructive/30" : "border-border",
      )}
    >
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        {/* Type icon */}
        <div className="p-1.5 rounded-md bg-muted">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Status badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                statusBgColor,
                statusColor,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
            </span>

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground">
              {formattedTime}
            </span>
          </div>

          {/* Subject (for email) */}
          {message.subject && (
            <p className="text-sm font-medium text-foreground truncate mb-0.5">
              {message.subject}
            </p>
          )}

          {/* Preview */}
          {!isExpanded && (
            <p className="text-sm text-muted-foreground truncate">
              {previewText}
            </p>
          )}
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 mt-1">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border">
          {/* Full message body */}
          <div className="mt-3 p-3 bg-muted/30 rounded-md">
            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
          </div>

          {/* Error message if failed */}
          {message.status === "failed" && message.errorMessage && (
            <div className="mt-2 p-2 bg-destructive/10 rounded-md">
              <p className="text-xs text-destructive">
                Error: {message.errorMessage}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>To: {message.toAddress}</span>
            {message.deliveredAt && (
              <span>
                Delivered:{" "}
                {new Date(message.deliveredAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
