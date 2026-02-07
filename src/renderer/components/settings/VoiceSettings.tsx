import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  DollarSign,
  MapPin,
  Clock,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import type { CredentialStatus } from "../../types/communication";

// ============================================================================
// Types
// ============================================================================

interface ScreeningCriteria {
  salaryMin?: number;
  salaryMax?: number;
  locations?: string[];
  noticePeriod?: string;
  requiredAvailability?: string;
  workAuthorization?: string;
}

type ElevenLabsStatus = CredentialStatus;

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ElevenLabsStatus }) {
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

// ============================================================================
// ElevenLabs Credentials Tab
// ============================================================================

function ElevenLabsTab({ projectId }: { projectId: string | null }) {
  const [status, setStatus] = useState<ElevenLabsStatus>("unconfigured");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    agentName?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Test call state
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isCallingTest, setIsCallingTest] = useState(false);
  const [testCallResult, setTestCallResult] = useState<{
    success: boolean;
    error?: string;
    callId?: string;
  } | null>(null);

  // Load credential status on mount
  useEffect(() => {
    loadCredentialStatus();
  }, [projectId]);

  const loadCredentialStatus = async () => {
    try {
      const [apiKeyStatus, agentIdStatus, phoneNumberIdStatus] =
        await Promise.all([
          window.api.getCredentialStatus(null, "elevenlabs", "api_key"),
          window.api.getCredentialStatus(
            projectId,
            "elevenlabs",
            "screening_agent_id",
          ),
          window.api.getCredentialStatus(
            projectId,
            "elevenlabs",
            "phone_number_id",
          ),
        ]);

      const hasAll =
        apiKeyStatus.configured &&
        (agentIdStatus.configured ||
          (
            await window.api.getCredentialStatus(
              null,
              "elevenlabs",
              "screening_agent_id",
            )
          ).configured) &&
        (phoneNumberIdStatus.configured ||
          (
            await window.api.getCredentialStatus(
              null,
              "elevenlabs",
              "phone_number_id",
            )
          ).configured);

      setStatus(hasAll ? "configured" : "unconfigured");
    } catch (error) {
      console.error("Failed to load credential status:", error);
    }
  };

  const validateInputs = (): boolean => {
    if (!apiKey.trim() && status === "unconfigured") {
      setValidationError("API Key is required");
      return false;
    }
    if (!agentId.trim() && status === "unconfigured") {
      setValidationError("Agent ID is required");
      return false;
    }
    if (!phoneNumberId.trim() && status === "unconfigured") {
      setValidationError("Phone Number ID is required");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    setIsSaving(true);
    setValidationError(null);
    setTestResult(null);

    try {
      // Store credentials - API key is always global, others can be project-specific
      const promises: Promise<unknown>[] = [];

      if (apiKey.trim()) {
        promises.push(
          window.api.storeCredential(null, "elevenlabs", "api_key", apiKey),
        );
      }
      if (agentId.trim()) {
        promises.push(
          window.api.storeCredential(
            projectId,
            "elevenlabs",
            "screening_agent_id",
            agentId,
          ),
        );
      }
      if (phoneNumberId.trim()) {
        promises.push(
          window.api.storeCredential(
            projectId,
            "elevenlabs",
            "phone_number_id",
            phoneNumberId,
          ),
        );
      }

      await Promise.all(promises);

      // Clear form and reload status
      setApiKey("");
      setAgentId("");
      setPhoneNumberId("");
      await loadCredentialStatus();
    } catch (error) {
      console.error("Failed to save credentials:", error);
      setValidationError("Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await window.api.testElevenLabsCredentials(projectId);
      setTestResult({
        success: result.success,
        error: result.error,
        agentName: result.data?.agentName,
      });

      if (result.success) {
        setStatus("verified");
      } else {
        setStatus("failed");
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      });
      setStatus("failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestCall = async () => {
    if (!testPhoneNumber.trim()) {
      setTestCallResult({ success: false, error: "Phone number is required" });
      return;
    }

    setIsCallingTest(true);
    setTestCallResult(null);

    try {
      const result = await window.api.initiateTestCall(
        projectId,
        testPhoneNumber.trim(),
      );
      setTestCallResult({
        success: result.success,
        error: result.error,
        callId: result.data?.callId,
      });
    } catch (error) {
      setTestCallResult({
        success: false,
        error: error instanceof Error ? error.message : "Test call failed",
      });
    } finally {
      setIsCallingTest(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="font-medium">ElevenLabs Voice AI</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-muted-foreground">
        Configure your ElevenLabs account for AI voice screening calls.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">API Key (Global)</label>
          <div className="flex gap-2 mt-1">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                status !== "unconfigured" ? "xi-•••••••••••" : "xi_api_key_..."
              }
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Found in ElevenLabs Settings &gt; API Keys
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Agent ID</label>
          <Input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder={
              status !== "unconfigured"
                ? "•••••••••••••••"
                : "your_agent_id_here"
            }
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Found in ElevenLabs Conversational AI &gt; Your Agent &gt; Agent ID
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Phone Number ID</label>
          <Input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder={
              status !== "unconfigured"
                ? "•••••••••••••••"
                : "your_phone_number_id"
            }
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Found in ElevenLabs Conversational AI &gt; Phone Numbers
          </p>
        </div>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      {testResult && !testResult.success && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {testResult.error}
        </div>
      )}

      {testResult?.success && testResult.agentName && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
          Connected to agent: {testResult.agentName}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={
            isSaving ||
            (!apiKey.trim() && !agentId.trim() && !phoneNumberId.trim())
          }
        >
          {isSaving ? "Saving..." : "Save Credentials"}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting || status === "unconfigured"}
        >
          {isTesting ? "Testing..." : "Test Connection"}
        </Button>
      </div>

      {/* Test Call Section */}
      {status === "verified" && (
        <div className="pt-4 mt-4 border-t border-border space-y-3">
          <div>
            <h4 className="font-medium text-sm">Make a Test Call</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Enter a phone number to receive a test screening call from the AI
              agent.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              type="tel"
              value={testPhoneNumber}
              onChange={(e) => setTestPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="flex-1"
            />
            <Button
              onClick={handleTestCall}
              disabled={isCallingTest || !testPhoneNumber.trim()}
            >
              {isCallingTest ? "Calling..." : "Call Now"}
            </Button>
          </div>

          {testCallResult && !testCallResult.success && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {testCallResult.error}
            </div>
          )}

          {testCallResult?.success && (
            <div className="p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
              Call initiated! Call ID: {testCallResult.callId}
              <p className="text-xs mt-1 opacity-80">
                You should receive a call shortly. Check the console for status
                updates.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Screening Criteria Tab
// ============================================================================

function ScreeningCriteriaTab({ projectId }: { projectId: string }) {
  const [criteria, setCriteria] = useState<ScreeningCriteria>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [locations, setLocations] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [availability, setAvailability] = useState("");
  const [workAuth, setWorkAuth] = useState("");

  // Load criteria on mount
  useEffect(() => {
    loadCriteria();
  }, [projectId]);

  const loadCriteria = async () => {
    try {
      const result = await window.api.getScreeningCriteria(projectId);
      if (result.success && result.data) {
        const data = result.data;
        setCriteria(data);
        setSalaryMin(data.salaryMin?.toString() || "");
        setSalaryMax(data.salaryMax?.toString() || "");
        setLocations(data.locations?.join(", ") || "");
        setNoticePeriod(data.noticePeriod || "");
        setAvailability(data.requiredAvailability || "");
        setWorkAuth(data.workAuthorization || "");
      }
    } catch (error) {
      console.error("Failed to load screening criteria:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const newCriteria: ScreeningCriteria = {};

      if (salaryMin.trim()) {
        const min = parseInt(salaryMin, 10);
        if (!isNaN(min)) newCriteria.salaryMin = min;
      }
      if (salaryMax.trim()) {
        const max = parseInt(salaryMax, 10);
        if (!isNaN(max)) newCriteria.salaryMax = max;
      }
      if (locations.trim()) {
        newCriteria.locations = locations
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean);
      }
      if (noticePeriod.trim()) {
        newCriteria.noticePeriod = noticePeriod;
      }
      if (availability.trim()) {
        newCriteria.requiredAvailability = availability;
      }
      if (workAuth.trim()) {
        newCriteria.workAuthorization = workAuth;
      }

      const result = await window.api.saveScreeningCriteria(
        projectId,
        newCriteria,
      );

      if (result.success) {
        setCriteria(newCriteria);
        setSaveMessage({ type: "success", text: "Screening criteria saved" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({
          type: "error",
          text: result.error || "Failed to save",
        });
      }
    } catch (error) {
      console.error("Failed to save screening criteria:", error);
      setSaveMessage({ type: "error", text: "Failed to save criteria" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">Screening Criteria</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Define the criteria used during AI screening calls. The agent will
        gather this information from candidates.
      </p>

      <div className="space-y-4">
        {/* Salary Range */}
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Salary Range
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min (e.g., 80000)"
              className="flex-1"
            />
            <span className="self-center text-muted-foreground">to</span>
            <Input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max (e.g., 120000)"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Target salary range for this role (annual, in local currency)
          </p>
        </div>

        {/* Locations */}
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Allowed Locations
          </label>
          <Input
            type="text"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="e.g., New York, Remote, San Francisco"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated list of acceptable work locations
          </p>
        </div>

        {/* Notice Period */}
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Notice Period
          </label>
          <select
            value={noticePeriod}
            onChange={(e) => setNoticePeriod(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Any notice period</option>
            <option value="immediate">Immediate</option>
            <option value="2 weeks">2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="2 months">2 months</option>
            <option value="3 months">3 months</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Maximum acceptable notice period
          </p>
        </div>

        {/* Availability */}
        <div>
          <label className="text-sm font-medium">Required Availability</label>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Any availability</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>

        {/* Work Authorization */}
        <div>
          <label className="text-sm font-medium">Work Authorization</label>
          <select
            value={workAuth}
            onChange={(e) => setWorkAuth(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Any work authorization</option>
            <option value="citizen">Citizen/Permanent Resident</option>
            <option value="visa_sponsorship">Visa Sponsorship OK</option>
            <option value="no_sponsorship">No Sponsorship</option>
          </select>
        </div>
      </div>

      {saveMessage && (
        <div
          className={`p-3 rounded-md text-sm ${
            saveMessage.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Criteria"}
      </Button>
    </div>
  );
}

// ============================================================================
// Main VoiceSettings Component
// ============================================================================

/**
 * Voice Settings panel for configuring ElevenLabs credentials and screening criteria.
 * Used in project settings for voice AI screening configuration.
 */
export function VoiceSettings() {
  const { id: projectId } = useParams<{ id: string }>();
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check encryption availability on mount
  useEffect(() => {
    const checkEncryption = async () => {
      try {
        const result = await window.api.isEncryptionAvailable();
        setEncryptionAvailable(result.available);
      } catch (error) {
        console.error("Failed to check encryption:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkEncryption();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground">Loading voice settings...</div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Voice Screening Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure AI voice screening for automated candidate pre-screening
          calls
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

      <Tabs defaultValue="credentials" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="credentials">
            <Phone className="h-4 w-4 mr-2" />
            ElevenLabs
          </TabsTrigger>
          <TabsTrigger value="criteria" disabled={!projectId}>
            <DollarSign className="h-4 w-4 mr-2" />
            Screening Criteria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-4">
          <ElevenLabsTab projectId={projectId || null} />
        </TabsContent>

        <TabsContent value="criteria" className="mt-4">
          {projectId ? (
            <ScreeningCriteriaTab projectId={projectId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a project to configure screening criteria.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VoiceSettings;
