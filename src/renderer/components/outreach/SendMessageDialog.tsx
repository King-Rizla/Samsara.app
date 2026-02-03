/**
 * SendMessageDialog - Dialog for composing and sending a message
 *
 * Features:
 * - Tabs for SMS / Email
 * - Template selector dropdown
 * - Recipient display with DNC warning
 * - Character count for SMS (160/153 per segment)
 * - Subject line for email
 * - Preview with template variables applied
 * - Send button with loading state
 */

import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, MessageSquare, Mail, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useTemplateStore } from "../../stores/templateStore";
import { useOutreachStore } from "../../stores/outreachStore";
import { cn } from "../../lib/utils";
import type { OutreachCandidate } from "../../types/communication";

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: OutreachCandidate | null;
  projectId: string;
  roleTitle?: string;
  companyName?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  candidate,
  projectId,
  roleTitle = "Open Position",
  companyName = "Our Company",
  recruiterName,
  recruiterEmail,
  recruiterPhone,
}: SendMessageDialogProps) {
  const [activeTab, setActiveTab] = useState<"sms" | "email">("sms");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isOnDNC, setIsOnDNC] = useState(false);

  const { templates, loadTemplates } = useTemplateStore();
  const { sendSMS, sendEmail, checkDNC, isSending, sendError, clearSendError } =
    useOutreachStore();

  // Filter templates by type
  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.type === activeTab),
    [templates, activeTab],
  );

  // Load templates on mount
  useEffect(() => {
    if (open && projectId) {
      loadTemplates(projectId);
    }
  }, [open, projectId, loadTemplates]);

  // Check DNC when candidate or tab changes
  useEffect(() => {
    async function check() {
      if (!candidate) return;

      setIsOnDNC(false);

      const contactValue =
        activeTab === "sms" ? candidate.phone : candidate.email;
      if (contactValue) {
        const onDNC = await checkDNC(
          activeTab === "sms" ? "phone" : "email",
          contactValue,
        );
        setIsOnDNC(onDNC);
      }
    }
    check();
  }, [candidate, activeTab, checkDNC]);

  // Apply template when selected
  useEffect(() => {
    if (!selectedTemplateId) return;
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      setBody(template.body);
      if (template.subject) {
        setSubject(template.subject);
      }
    }
  }, [selectedTemplateId, templates]);

  // Reset form when dialog opens/closes or tab changes
  useEffect(() => {
    if (open) {
      setSelectedTemplateId("");
      setSubject("");
      setBody("");
      clearSendError();
    }
  }, [open, activeTab, clearSendError]);

  // Build variables for template rendering
  const templateVariables = useMemo(() => {
    const firstName = candidate?.name?.split(" ")[0] || "";
    return {
      candidate_name: candidate?.name || "",
      candidate_first_name: firstName,
      candidate_email: candidate?.email || "",
      candidate_phone: candidate?.phone || "",
      role_title: roleTitle,
      company_name: companyName,
      recruiter_name: recruiterName || "",
      recruiter_email: recruiterEmail || "",
      recruiter_phone: recruiterPhone || "",
    };
  }, [
    candidate,
    roleTitle,
    companyName,
    recruiterName,
    recruiterEmail,
    recruiterPhone,
  ]);

  // Render preview with variable substitution
  const renderedBody = useMemo(() => {
    return body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = templateVariables[key as keyof typeof templateVariables];
      return value !== undefined ? value : match;
    });
  }, [body, templateVariables]);

  const renderedSubject = useMemo(() => {
    return subject.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = templateVariables[key as keyof typeof templateVariables];
      return value !== undefined ? value : match;
    });
  }, [subject, templateVariables]);

  // SMS character count and segment calculation
  const smsStats = useMemo(() => {
    const text = renderedBody;
    const length = text.length;
    // GSM-7: 160 chars for single segment, 153 for multi-segment (UDH header)
    const isMultiSegment = length > 160;
    const charsPerSegment = isMultiSegment ? 153 : 160;
    const segments = isMultiSegment ? Math.ceil(length / 153) : 1;
    return { length, segments, charsPerSegment };
  }, [renderedBody]);

  // Handle send
  const handleSend = async () => {
    if (!candidate) return;

    if (activeTab === "sms") {
      if (!candidate.phone) return;
      const result = await sendSMS({
        projectId,
        cvId: candidate.cvId,
        toPhone: candidate.phone,
        body: renderedBody,
        templateId: selectedTemplateId || undefined,
      });
      if (result.success) {
        onOpenChange(false);
      }
    } else {
      if (!candidate.email) return;
      const result = await sendEmail({
        projectId,
        cvId: candidate.cvId,
        toEmail: candidate.email,
        subject: renderedSubject,
        body: renderedBody,
        templateId: selectedTemplateId || undefined,
      });
      if (result.success) {
        onOpenChange(false);
      }
    }
  };

  // Determine if send is disabled
  const isSendDisabled =
    isSending ||
    isOnDNC ||
    !body.trim() ||
    (activeTab === "sms" && !candidate?.phone) ||
    (activeTab === "email" && (!candidate?.email || !subject.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTab === "sms" ? (
              <MessageSquare className="h-5 w-5" />
            ) : (
              <Mail className="h-5 w-5" />
            )}
            Send Message to {candidate?.name || "Candidate"}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "sms" | "email")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="sms"
              disabled={!candidate?.phone}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger
              value="email"
              disabled={!candidate?.email}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* DNC Warning */}
            {isOnDNC && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Do Not Contact
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This {activeTab === "sms" ? "phone number" : "email"} is on
                    the Do Not Contact list.
                  </p>
                </div>
              </div>
            )}

            {/* Recipient */}
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <p className="text-sm font-medium">
                {activeTab === "sms"
                  ? candidate?.phone || "No phone"
                  : candidate?.email || "No email"}
              </p>
            </div>

            {/* Template selector */}
            <div>
              <Label htmlFor="template">Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template or write custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Custom message</SelectItem>
                  {filteredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject (email only) */}
            <TabsContent value="email" className="mt-0 p-0">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line"
                />
              </div>
            </TabsContent>

            {/* Message body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="body">Message</Label>
                {activeTab === "sms" && (
                  <span
                    className={cn(
                      "text-xs",
                      smsStats.length > 160
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {smsStats.length} chars ({smsStats.segments} segment
                    {smsStats.segments > 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Type your ${activeTab === "sms" ? "SMS" : "email"} message...`}
                className="min-h-[120px]"
              />
            </div>

            {/* Preview */}
            {body && (
              <div>
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-md border">
                  {activeTab === "email" && renderedSubject && (
                    <p className="text-sm font-medium mb-2 pb-2 border-b">
                      {renderedSubject}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{renderedBody}</p>
                </div>
              </div>
            )}

            {/* Error message */}
            {sendError && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{sendError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={isSendDisabled}>
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {activeTab === "sms" ? "SMS" : "Email"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
