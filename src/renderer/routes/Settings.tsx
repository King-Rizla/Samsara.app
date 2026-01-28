import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { LLMSettings } from '../components/settings/LLMSettings';
import { useUsageStore, formatTokens, estimateCost } from '../stores/usageStore';
import { useSettingsStore } from '../stores/settingsStore';

// Preset limits with cost estimates (per CONTEXT.md)
const LIMIT_PRESETS = [
  { value: 10_000, label: '10K' },
  { value: 50_000, label: '50K' },
  { value: 100_000, label: '100K' },
  { value: 500_000, label: '500K' },
];

export function Settings() {
  const navigate = useNavigate();
  const { globalUsage, globalTokenLimit, warningThreshold, llmMode, loadSettings, loadUsage } = useUsageStore();
  const { recruiter, loadRecruiterSettings, saveRecruiterSettings } = useSettingsStore();

  const [limit, setLimit] = useState<string>(globalTokenLimit?.toString() ?? '');
  const [threshold, setThreshold] = useState<string>(warningThreshold.toString());
  const [isSaving, setIsSaving] = useState(false);

  // Recruiter settings state
  const [recruiterName, setRecruiterName] = useState(recruiter.name ?? '');
  const [recruiterPhone, setRecruiterPhone] = useState(recruiter.phone ?? '');
  const [recruiterEmail, setRecruiterEmail] = useState(recruiter.email ?? '');
  const [isSavingRecruiter, setIsSavingRecruiter] = useState(false);

  // Load settings and usage on mount
  useEffect(() => {
    loadSettings();
    loadUsage();
    loadRecruiterSettings();
  }, [loadSettings, loadUsage, loadRecruiterSettings]);

  useEffect(() => {
    setLimit(globalTokenLimit?.toString() ?? '');
    setThreshold(warningThreshold.toString());
  }, [globalTokenLimit, warningThreshold]);

  // Sync local state when recruiter changes
  useEffect(() => {
    setRecruiterName(recruiter.name ?? '');
    setRecruiterPhone(recruiter.phone ?? '');
    setRecruiterEmail(recruiter.email ?? '');
  }, [recruiter]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: { globalTokenLimit?: number; warningThreshold?: number } = {};

      if (limit.trim() === '' || limit === '0') {
        updates.globalTokenLimit = undefined;
      } else {
        const parsed = parseInt(limit, 10);
        if (!isNaN(parsed) && parsed > 0) {
          updates.globalTokenLimit = parsed;
        }
      }

      const parsedThreshold = parseInt(threshold, 10);
      if (!isNaN(parsedThreshold) && parsedThreshold > 0 && parsedThreshold <= 100) {
        updates.warningThreshold = parsedThreshold;
      }

      await window.api.updateAppSettings(updates);
      await loadSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresetClick = (value: number) => {
    setLimit(value.toString());
  };

  const handleSaveRecruiter = async () => {
    setIsSavingRecruiter(true);
    try {
      const success = await saveRecruiterSettings({
        name: recruiterName || undefined,
        phone: recruiterPhone || undefined,
        email: recruiterEmail || undefined,
      });
      if (success) {
        toast.success('Recruiter details saved');
      } else {
        toast.error('Failed to save recruiter details');
      }
    } catch (error) {
      toast.error('Failed to save recruiter details');
    } finally {
      setIsSavingRecruiter(false);
    }
  };

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
        </div>

        {/* LLM Settings Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Processing Mode</CardTitle>
            <CardDescription>Choose between local privacy or cloud speed</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <LLMSettings />
          </CardContent>
        </Card>

        {/* Usage Limits Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Usage Limits</CardTitle>
            <CardDescription>
              Configure monthly token limits to control API costs. Resets on the 1st of each month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current usage display */}
            <div className="text-sm text-muted-foreground">
              Current usage: {formatTokens(globalUsage.totalTokens)} tokens
              {llmMode === 'cloud' && estimateCost(globalUsage.totalTokens, llmMode) && (
                <span> ({estimateCost(globalUsage.totalTokens, llmMode)})</span>
              )}
            </div>

            {/* Preset quick picks (per CONTEXT.md) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Monthly Token Limit</label>
              <div className="flex flex-wrap gap-2">
                {LIMIT_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={limit === preset.value.toString() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePresetClick(preset.value)}
                  >
                    {preset.label}
                    {llmMode === 'cloud' && (
                      <span className="ml-1 text-xs opacity-70">
                        ({estimateCost(preset.value, llmMode)})
                      </span>
                    )}
                  </Button>
                ))}
                <Button
                  variant={!LIMIT_PRESETS.some(p => p.value.toString() === limit) && limit !== '' ? 'outline' : limit === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLimit('')}
                >
                  Unlimited
                </Button>
              </div>
            </div>

            {/* Custom input */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Or enter custom limit:</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                           text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Warning threshold */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Warning Threshold (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                           text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Show warning toast when usage reaches this percentage of limit (default: 80%)
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Limits'}
            </Button>
          </CardContent>
        </Card>

        {/* Recruiter Details Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Recruiter Details
            </CardTitle>
            <CardDescription>
              Your contact details for the Blind Profile footer. Recipients will contact you, not the candidate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                           text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input
                type="tel"
                value={recruiterPhone}
                onChange={(e) => setRecruiterPhone(e.target.value)}
                placeholder="Your phone number"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                           text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm
                           text-foreground placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button onClick={handleSaveRecruiter} disabled={isSavingRecruiter}>
              {isSavingRecruiter ? 'Saving...' : 'Save Details'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
