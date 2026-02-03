import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  MessageSquare,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useCommunicationStore } from "../../stores/communicationStore";
import type { CredentialStatus } from "../../types/communication";

/**
 * Status indicator badge for credential configuration state.
 */
function StatusBadge({ status }: { status: CredentialStatus }) {
  const config = {
    unconfigured: {
      icon: AlertCircle,
      color: "text-muted-foreground",
      bg: "bg-muted",
      label: "Not configured",
    },
    configured: {
      icon: AlertCircle,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      label: "Configured (untested)",
    },
    verified: {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
      label: "Verified",
    },
    failed: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      label: "Verification failed",
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.color} ${config.bg}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  );
}

/**
 * Twilio SMS credentials form.
 */
function TwilioTab({ projectId }: { projectId: string | null }) {
  const {
    twilioStatus,
    twilioTestResult,
    isTestingTwilio,
    isSaving,
    saveTwilioCredentials,
    testTwilio,
  } = useCommunicationStore();

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate inputs
  const validateInputs = (): boolean => {
    // Account SID must start with "AC" and be 34 characters
    if (!accountSid.startsWith("AC") || accountSid.length !== 34) {
      setValidationError(
        "Account SID must start with 'AC' and be 34 characters",
      );
      return false;
    }

    // Auth token is typically 32 characters
    if (authToken.length < 20) {
      setValidationError("Auth Token appears too short");
      return false;
    }

    // Phone number should be E.164 format
    if (!phoneNumber.startsWith("+") || phoneNumber.length < 10) {
      setValidationError(
        "Phone number must be in E.164 format (e.g., +15551234567)",
      );
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    const success = await saveTwilioCredentials(
      projectId,
      accountSid,
      authToken,
      phoneNumber,
    );

    if (success) {
      // Clear form after successful save
      setAccountSid("");
      setAuthToken("");
      setPhoneNumber("");
    }
  };

  const handleTest = async () => {
    await testTwilio(projectId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Twilio SMS</h3>
        </div>
        <StatusBadge status={twilioStatus} />
      </div>

      <p className="text-sm text-muted-foreground">
        Configure your Twilio account to send SMS messages to candidates.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Account SID</label>
          <Input
            type="text"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder={
              twilioStatus !== "unconfigured" ? "AC•••••••••••••••" : "AC..."
            }
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Found in Twilio Console → Account Info
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Auth Token</label>
          <div className="flex gap-2 mt-1">
            <Input
              type={showAuthToken ? "text" : "password"}
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={
                twilioStatus !== "unconfigured"
                  ? "•••••••••••••••"
                  : "Enter token"
              }
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuthToken(!showAuthToken)}
            >
              {showAuthToken ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Phone Number</label>
          <Input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder={
              twilioStatus !== "unconfigured" ? "+1••••••••••" : "+15551234567"
            }
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your Twilio phone number in E.164 format
          </p>
        </div>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      {twilioTestResult && !twilioTestResult.success && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {twilioTestResult.error}
        </div>
      )}

      {twilioTestResult?.success && twilioTestResult.friendlyName && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
          Connected to account: {twilioTestResult.friendlyName}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={
            isSaving ||
            !accountSid.trim() ||
            !authToken.trim() ||
            !phoneNumber.trim()
          }
        >
          {isSaving ? "Saving..." : "Save Credentials"}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTestingTwilio || twilioStatus === "unconfigured"}
        >
          {isTestingTwilio ? "Testing..." : "Test Connection"}
        </Button>
      </div>
    </div>
  );
}

/**
 * SMTP Email credentials form.
 */
function SmtpTab({ projectId }: { projectId: string | null }) {
  const {
    smtpStatus,
    smtpTestResult,
    isTestingSmtp,
    isSaving,
    saveSmtpCredentials,
    testSmtp,
  } = useCommunicationStore();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate inputs
  const validateInputs = (): boolean => {
    if (!host.trim()) {
      setValidationError("SMTP host is required");
      return false;
    }

    if (!user.trim()) {
      setValidationError("Username is required");
      return false;
    }

    if (!password.trim()) {
      setValidationError("Password is required");
      return false;
    }

    // Basic email validation for from_email
    if (fromEmail && !fromEmail.includes("@")) {
      setValidationError("Invalid from email address");
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    const success = await saveSmtpCredentials(
      projectId,
      host,
      port,
      user,
      password,
      fromEmail || user, // Default fromEmail to user if not specified
    );

    if (success) {
      // Clear form after successful save
      setHost("");
      setPort("587");
      setUser("");
      setPassword("");
      setFromEmail("");
    }
  };

  const handleTest = async () => {
    await testSmtp(projectId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Email (SMTP)</h3>
        </div>
        <StatusBadge status={smtpStatus} />
      </div>

      <p className="text-sm text-muted-foreground">
        Configure SMTP settings to send email messages to candidates.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">SMTP Host</label>
            <Input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Port</label>
            <select
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="587">587 (TLS)</option>
              <option value="465">465 (SSL)</option>
              <option value="25">25 (Unencrypted)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Username</label>
          <Input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="your@email.com"
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <div className="flex gap-2 mt-1">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                smtpStatus !== "unconfigured"
                  ? "•••••••••••••••"
                  : "App password"
              }
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            For Gmail, use an App Password (not your regular password)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">From Email (optional)</label>
          <Input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder={user || "your@email.com"}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Defaults to username if not specified
          </p>
        </div>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      {smtpTestResult && !smtpTestResult.success && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {smtpTestResult.error}
        </div>
      )}

      {smtpTestResult?.success && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
          SMTP connection verified successfully
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={
            isSaving || !host.trim() || !user.trim() || !password.trim()
          }
        >
          {isSaving ? "Saving..." : "Save Credentials"}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTestingSmtp || smtpStatus === "unconfigured"}
        >
          {isTestingSmtp ? "Testing..." : "Test Connection"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Communication Settings panel for configuring Twilio and SMTP providers.
 */
export function CommunicationSettings() {
  const { id: projectId } = useParams<{ id: string }>();
  const {
    encryptionAvailable,
    isLoadingStatus,
    checkEncryptionAvailable,
    loadCredentialStatus,
  } = useCommunicationStore();

  // Load status on mount
  useEffect(() => {
    checkEncryptionAvailable();
    loadCredentialStatus(projectId || null);
  }, [projectId, checkEncryptionAvailable, loadCredentialStatus]);

  if (isLoadingStatus) {
    return (
      <div className="p-4 text-muted-foreground">
        Loading communication settings...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Communication Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure SMS and email providers for candidate outreach
        </p>
      </div>

      {/* Encryption status notice */}
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
        <Shield className="h-4 w-4 text-primary" />
        {encryptionAvailable ? (
          <span>Credentials encrypted with OS keychain</span>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">
            Warning: Secure storage not available on this system
          </span>
        )}
      </div>

      <Tabs defaultValue="twilio" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="twilio">
            <MessageSquare className="h-4 w-4 mr-2" />
            Twilio SMS
          </TabsTrigger>
          <TabsTrigger value="smtp">
            <Mail className="h-4 w-4 mr-2" />
            Email SMTP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="twilio" className="mt-4">
          <TwilioTab projectId={projectId || null} />
        </TabsContent>

        <TabsContent value="smtp" className="mt-4">
          <SmtpTab projectId={projectId || null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CommunicationSettings;
