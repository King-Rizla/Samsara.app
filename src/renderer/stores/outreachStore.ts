/**
 * Outreach Store - Phase 9 Plan 03
 *
 * Manages outreach state including candidates, messages, and DNC list.
 */

import { create } from "zustand";
import type {
  Message,
  DNCEntry,
  OutreachCandidate,
} from "../types/communication";

// ============================================================================
// Call Record Types (Phase 11 Plan 03)
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

interface OutreachState {
  // Candidates in outreach pipeline
  candidates: OutreachCandidate[];
  selectedCandidateId: string | null;

  // Messages for selected candidate
  messages: Message[];
  isLoadingMessages: boolean;

  // Call records for selected candidate (Phase 11 Plan 03)
  callRecords: CallRecord[];
  isLoadingCallRecords: boolean;

  // DNC list
  dncList: DNCEntry[];

  // Sending state
  isSending: boolean;
  sendError: string | null;

  // Actions - setters
  setCandidates: (candidates: OutreachCandidate[]) => void;
  selectCandidate: (cvId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (
    id: string,
    status: Message["status"],
    errorMessage?: string,
  ) => void;
  setDNCList: (list: DNCEntry[]) => void;
  clearSendError: () => void;

  // Actions - async
  loadMessagesForCandidate: (cvId: string) => Promise<void>;
  loadCallRecordsForCandidate: (cvId: string) => Promise<void>;
  loadDNCList: () => Promise<void>;
  sendSMS: (params: {
    projectId: string;
    cvId: string;
    toPhone: string;
    body: string;
    templateId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  sendEmail: (params: {
    projectId: string;
    cvId: string;
    toEmail: string;
    subject: string;
    body: string;
    templateId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  addToDNC: (
    type: "phone" | "email",
    value: string,
    reason: "manual",
  ) => Promise<boolean>;
  checkDNC: (type: "phone" | "email", value: string) => Promise<boolean>;
  removeFromDNC: (type: "phone" | "email", value: string) => Promise<boolean>;
}

export const useOutreachStore = create<OutreachState>((set, get) => ({
  // Initial state
  candidates: [],
  selectedCandidateId: null,
  messages: [],
  isLoadingMessages: false,
  callRecords: [],
  isLoadingCallRecords: false,
  dncList: [],
  isSending: false,
  sendError: null,

  // Setters
  setCandidates: (candidates) => set({ candidates }),
  selectCandidate: (cvId) =>
    set({ selectedCandidateId: cvId, messages: [], callRecords: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [message, ...state.messages] })),
  updateMessageStatus: (id, status, errorMessage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, status, errorMessage: errorMessage || null } : m,
      ),
    })),
  setDNCList: (list) => set({ dncList: list }),
  clearSendError: () => set({ sendError: null }),

  // Load messages for a candidate
  loadMessagesForCandidate: async (cvId: string) => {
    set({ isLoadingMessages: true });
    try {
      const result = await window.api.getMessagesByCV(cvId);
      if (result.success && result.data) {
        // Convert snake_case records to camelCase
        const messages = (
          result.data as Array<{
            id: string;
            project_id: string;
            cv_id: string | null;
            type: string;
            direction: string;
            status: string;
            from_address: string | null;
            to_address: string;
            subject: string | null;
            body: string;
            template_id: string | null;
            provider_message_id: string | null;
            error_message: string | null;
            sent_at: string | null;
            delivered_at: string | null;
            created_at: string;
          }>
        ).map((record) => ({
          id: record.id,
          projectId: record.project_id,
          cvId: record.cv_id,
          type: record.type as "sms" | "email",
          direction: record.direction as "outbound" | "inbound",
          status: record.status as Message["status"],
          fromAddress: record.from_address,
          toAddress: record.to_address,
          subject: record.subject,
          body: record.body,
          templateId: record.template_id,
          providerMessageId: record.provider_message_id,
          errorMessage: record.error_message,
          sentAt: record.sent_at,
          deliveredAt: record.delivered_at,
          createdAt: record.created_at,
        }));
        set({ messages, isLoadingMessages: false });
      } else {
        set({ isLoadingMessages: false });
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      set({ isLoadingMessages: false });
    }
  },

  // Load call records for a candidate (Phase 11 Plan 03, updated Phase 12)
  loadCallRecordsForCandidate: async (cvId: string) => {
    set({ isLoadingCallRecords: true });
    try {
      const result = await window.api.getCallRecords(cvId);
      if (result.success && result.data) {
        const records = result.data.map(
          (record: {
            id: string;
            type?: string;
            status: string;
            durationSeconds?: number;
            screeningOutcome?: string;
            screeningConfidence?: number;
            extractedDataJson?: string;
            startedAt: string;
            endedAt?: string;
            transcriptionStatus?: string;
          }) => ({
            id: record.id,
            type: (record.type || "screening") as CallRecord["type"],
            status: record.status as CallRecord["status"],
            durationSeconds: record.durationSeconds,
            screeningOutcome:
              record.screeningOutcome as CallRecord["screeningOutcome"],
            screeningConfidence: record.screeningConfidence,
            extractedDataJson: record.extractedDataJson,
            startedAt: record.startedAt,
            endedAt: record.endedAt,
            transcriptionStatus:
              record.transcriptionStatus as CallRecord["transcriptionStatus"],
          }),
        );
        set({ callRecords: records, isLoadingCallRecords: false });
      } else {
        set({ isLoadingCallRecords: false });
      }
    } catch (error) {
      console.error("Failed to load call records:", error);
      set({ callRecords: [], isLoadingCallRecords: false });
    }
  },

  // Load DNC list
  loadDNCList: async () => {
    try {
      const result = await window.api.getDNCList();
      if (result.success && result.data) {
        set({
          dncList: result.data.map((entry) => ({
            id: entry.id,
            type: entry.type as "phone" | "email",
            value: entry.value,
            reason: entry.reason as "opt_out" | "bounce" | "manual",
            createdAt: entry.createdAt,
          })),
        });
      }
    } catch (error) {
      console.error("Failed to load DNC list:", error);
    }
  },

  // Send SMS
  sendSMS: async (params) => {
    set({ isSending: true, sendError: null });
    try {
      const result = await window.api.sendSMS(params);
      set({ isSending: false });
      if (result.success) {
        // Reload messages to show the new one
        get().loadMessagesForCandidate(params.cvId);
        return { success: true };
      } else {
        set({ sendError: result.error || "Failed to send SMS" });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to send SMS";
      set({ isSending: false, sendError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  // Send Email
  sendEmail: async (params) => {
    set({ isSending: true, sendError: null });
    try {
      const result = await window.api.sendEmail(params);
      set({ isSending: false });
      if (result.success) {
        // Reload messages to show the new one
        get().loadMessagesForCandidate(params.cvId);
        return { success: true };
      } else {
        set({ sendError: result.error || "Failed to send email" });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to send email";
      set({ isSending: false, sendError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  // Add to DNC
  addToDNC: async (type, value, reason) => {
    try {
      const result = await window.api.addToDNC(type, value, reason);
      if (result.success) {
        get().loadDNCList();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to add to DNC:", error);
      return false;
    }
  },

  // Check DNC
  checkDNC: async (type, value) => {
    try {
      const result = await window.api.checkDNC(type, value);
      return result.onDNC;
    } catch (error) {
      console.error("Failed to check DNC:", error);
      return false;
    }
  },

  // Remove from DNC
  removeFromDNC: async (type, value) => {
    try {
      const result = await window.api.removeFromDNC(type, value);
      if (result.success && result.removed) {
        get().loadDNCList();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to remove from DNC:", error);
      return false;
    }
  },
}));
