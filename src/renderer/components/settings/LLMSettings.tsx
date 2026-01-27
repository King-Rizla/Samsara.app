import { useState, useEffect } from 'react';
import { Button } from '../ui/button';

type LLMMode = 'local' | 'cloud';

interface LLMSettingsState {
  llmMode: LLMMode;
  hasApiKey: boolean;
}

/**
 * LLM Settings panel for switching between Privacy Mode (local) and Speed Mode (cloud).
 */
export function LLMSettings() {
  const [settings, setSettings] = useState<LLMSettingsState | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.api.getLLMSettings();
      if (result.success && result.data) {
        setSettings(result.data as LLMSettingsState);
      }
    } catch (err) {
      console.error('Failed to load LLM settings:', err);
    }
  };

  const handleModeChange = async (mode: LLMMode) => {
    setIsLoading(true);
    setError(null);

    try {
      // If switching to cloud, require API key
      if (mode === 'cloud' && !settings?.hasApiKey && !apiKey) {
        setError('Please enter an OpenAI API key for Speed Mode');
        setIsLoading(false);
        return;
      }

      const result = await window.api.setLLMSettings(
        mode,
        mode === 'cloud' ? apiKey || undefined : undefined
      );

      if (result.success && result.data) {
        setSettings(result.data as LLMSettingsState);
        setApiKey(''); // Clear the input after successful save
      } else {
        setError(result.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.setLLMSettings('cloud', apiKey);
      if (result.success && result.data) {
        setSettings(result.data as LLMSettingsState);
        setApiKey('');
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-4 text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Processing Mode</h3>

      <div className="space-y-3">
        {/* Privacy Mode (Local) */}
        <label
          className={`
            flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
            ${settings.llmMode === 'local'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground'
            }
          `}
        >
          <input
            type="radio"
            name="llmMode"
            value="local"
            checked={settings.llmMode === 'local'}
            onChange={() => handleModeChange('local')}
            disabled={isLoading}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium text-foreground">Privacy Mode (Local)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Data never leaves your machine. Slower processing (~60-90s per CV).
              Requires Ollama with qwen2.5:7b model.
            </div>
          </div>
        </label>

        {/* Speed Mode (Cloud) */}
        <label
          className={`
            flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
            ${settings.llmMode === 'cloud'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground'
            }
          `}
        >
          <input
            type="radio"
            name="llmMode"
            value="cloud"
            checked={settings.llmMode === 'cloud'}
            onChange={() => handleModeChange('cloud')}
            disabled={isLoading || (!settings.hasApiKey && !apiKey)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium text-foreground">Speed Mode (Cloud)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Fast processing (~2-3s per CV). Data sent to OpenAI API.
              Requires API key. ~$0.001 per CV.
            </div>
            {settings.hasApiKey && settings.llmMode === 'cloud' && (
              <div className="text-xs text-green-500 mt-1">
                API key configured
              </div>
            )}
          </div>
        </label>
      </div>

      {/* API Key input - shown when cloud mode is selected or being configured */}
      {(settings.llmMode === 'cloud' || !settings.hasApiKey) && (
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-sm font-medium text-foreground">
            OpenAI API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasApiKey ? '••••••••••••••••' : 'sk-...'}
              className="flex-1 px-3 py-2 bg-muted border border-border rounded-md
                         text-foreground placeholder:text-muted-foreground text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={isLoading}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveApiKey}
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <span className="text-primary">platform.openai.com/api-keys</span>
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          Restarting extraction engine with new settings...
        </p>
      )}
    </div>
  );
}
