import { create } from "zustand";
import type { CredentialStatus } from "../types/communication";

interface CommunicationState {
  // Provider status
  twilioStatus: CredentialStatus;
  smtpStatus: CredentialStatus;

  // Test results
  twilioTestResult: {
    success: boolean;
    error?: string;
    friendlyName?: string;
  } | null;
  smtpTestResult: { success: boolean; error?: string } | null;

  // Loading states
  isTestingTwilio: boolean;
  isTestingSmtp: boolean;
  isSaving: boolean;
  isLoadingStatus: boolean;

  // Encryption availability
  encryptionAvailable: boolean | null;

  // Actions - setters
  setTwilioStatus: (status: CredentialStatus) => void;
  setSmtpStatus: (status: CredentialStatus) => void;
  setTwilioTestResult: (
    result: { success: boolean; error?: string; friendlyName?: string } | null,
  ) => void;
  setSmtpTestResult: (
    result: { success: boolean; error?: string } | null,
  ) => void;
  setIsTestingTwilio: (testing: boolean) => void;
  setIsTestingSmtp: (testing: boolean) => void;
  setIsSaving: (saving: boolean) => void;

  // Actions - async
  checkEncryptionAvailable: () => Promise<boolean>;
  loadCredentialStatus: (projectId: string | null) => Promise<void>;
  saveTwilioCredentials: (
    projectId: string | null,
    accountSid: string,
    authToken: string,
    phoneNumber: string,
  ) => Promise<boolean>;
  saveSmtpCredentials: (
    projectId: string | null,
    host: string,
    port: string,
    user: string,
    password: string,
    fromEmail: string,
  ) => Promise<boolean>;
  testTwilio: (projectId: string | null) => Promise<void>;
  testSmtp: (projectId: string | null) => Promise<void>;
}

export const useCommunicationStore = create<CommunicationState>((set) => ({
  // Initial state
  twilioStatus: "unconfigured",
  smtpStatus: "unconfigured",
  twilioTestResult: null,
  smtpTestResult: null,
  isTestingTwilio: false,
  isTestingSmtp: false,
  isSaving: false,
  isLoadingStatus: false,
  encryptionAvailable: null,

  // Setters
  setTwilioStatus: (status) => set({ twilioStatus: status }),
  setSmtpStatus: (status) => set({ smtpStatus: status }),
  setTwilioTestResult: (result) => set({ twilioTestResult: result }),
  setSmtpTestResult: (result) => set({ smtpTestResult: result }),
  setIsTestingTwilio: (testing) => set({ isTestingTwilio: testing }),
  setIsTestingSmtp: (testing) => set({ isTestingSmtp: testing }),
  setIsSaving: (saving) => set({ isSaving: saving }),

  // Check if encryption is available
  checkEncryptionAvailable: async () => {
    try {
      const result = await window.api.isEncryptionAvailable();
      set({ encryptionAvailable: result.available });
      return result.available;
    } catch (error) {
      console.error("Failed to check encryption availability:", error);
      set({ encryptionAvailable: false });
      return false;
    }
  },

  // Load credential status for both providers
  loadCredentialStatus: async (projectId: string | null) => {
    set({ isLoadingStatus: true });

    try {
      // Check Twilio credentials
      const [twilioSid, twilioToken, twilioPhone] = await Promise.all([
        window.api.getCredentialStatus(projectId, "twilio", "account_sid"),
        window.api.getCredentialStatus(projectId, "twilio", "auth_token"),
        window.api.getCredentialStatus(projectId, "twilio", "phone_number"),
      ]);

      const twilioConfigured =
        twilioSid.configured &&
        twilioToken.configured &&
        twilioPhone.configured;
      set({
        twilioStatus: twilioConfigured ? "configured" : "unconfigured",
        twilioTestResult: null,
      });

      // Check SMTP credentials
      const [smtpHost, smtpUser, smtpPassword] = await Promise.all([
        window.api.getCredentialStatus(projectId, "smtp", "host"),
        window.api.getCredentialStatus(projectId, "smtp", "user"),
        window.api.getCredentialStatus(projectId, "smtp", "password"),
      ]);

      const smtpConfigured =
        smtpHost.configured && smtpUser.configured && smtpPassword.configured;
      set({
        smtpStatus: smtpConfigured ? "configured" : "unconfigured",
        smtpTestResult: null,
      });
    } catch (error) {
      console.error("Failed to load credential status:", error);
    } finally {
      set({ isLoadingStatus: false });
    }
  },

  // Save Twilio credentials
  saveTwilioCredentials: async (
    projectId: string | null,
    accountSid: string,
    authToken: string,
    phoneNumber: string,
  ): Promise<boolean> => {
    set({ isSaving: true });

    try {
      // Store all three credentials
      const results = await Promise.all([
        window.api.storeCredential(
          projectId,
          "twilio",
          "account_sid",
          accountSid,
        ),
        window.api.storeCredential(
          projectId,
          "twilio",
          "auth_token",
          authToken,
        ),
        window.api.storeCredential(
          projectId,
          "twilio",
          "phone_number",
          phoneNumber,
        ),
      ]);

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        set({ twilioStatus: "configured", twilioTestResult: null });
      }
      return allSuccess;
    } catch (error) {
      console.error("Failed to save Twilio credentials:", error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  // Save SMTP credentials
  saveSmtpCredentials: async (
    projectId: string | null,
    host: string,
    port: string,
    user: string,
    password: string,
    fromEmail: string,
  ): Promise<boolean> => {
    set({ isSaving: true });

    try {
      // Store all SMTP credentials
      const results = await Promise.all([
        window.api.storeCredential(projectId, "smtp", "host", host),
        window.api.storeCredential(projectId, "smtp", "port", port),
        window.api.storeCredential(projectId, "smtp", "user", user),
        window.api.storeCredential(projectId, "smtp", "password", password),
        window.api.storeCredential(projectId, "smtp", "from_email", fromEmail),
      ]);

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        set({ smtpStatus: "configured", smtpTestResult: null });
      }
      return allSuccess;
    } catch (error) {
      console.error("Failed to save SMTP credentials:", error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  // Test Twilio credentials
  testTwilio: async (projectId: string | null) => {
    set({ isTestingTwilio: true, twilioTestResult: null });

    try {
      const result = await window.api.testTwilioCredentials(projectId);

      if (result.success && result.data) {
        set({
          twilioStatus: "verified",
          twilioTestResult: {
            success: true,
            friendlyName: result.data.friendlyName,
          },
        });
      } else {
        set({
          twilioStatus: "failed",
          twilioTestResult: {
            success: false,
            error: result.error || "Verification failed",
          },
        });
      }
    } catch (error) {
      console.error("Failed to test Twilio credentials:", error);
      set({
        twilioStatus: "failed",
        twilioTestResult: {
          success: false,
          error: error instanceof Error ? error.message : "Verification failed",
        },
      });
    } finally {
      set({ isTestingTwilio: false });
    }
  },

  // Test SMTP credentials
  testSmtp: async (projectId: string | null) => {
    set({ isTestingSmtp: true, smtpTestResult: null });

    try {
      const result = await window.api.testSmtpCredentials(projectId);

      if (result.success) {
        set({
          smtpStatus: "verified",
          smtpTestResult: { success: true },
        });
      } else {
        set({
          smtpStatus: "failed",
          smtpTestResult: {
            success: false,
            error: result.error || "Verification failed",
          },
        });
      }
    } catch (error) {
      console.error("Failed to test SMTP credentials:", error);
      set({
        smtpStatus: "failed",
        smtpTestResult: {
          success: false,
          error: error instanceof Error ? error.message : "Verification failed",
        },
      });
    } finally {
      set({ isTestingSmtp: false });
    }
  },
}));
