/**
 * Settings management for Samsara.
 * Stores settings in a JSON file in the app's userData directory.
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  llmMode: 'local' | 'cloud';
  openaiApiKey?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  llmMode: 'local',
};

let cachedSettings: AppSettings | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  if (cachedSettings) {
    return cachedSettings;
  }

  const settingsPath = getSettingsPath();

  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } else {
      cachedSettings = { ...DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }

  return cachedSettings;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...settings };

  const settingsPath = getSettingsPath();
  console.log('saveSettings: Writing to', settingsPath);

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
    cachedSettings = updated;
    console.log('saveSettings: Successfully wrote settings file');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }

  return updated;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return loadSettings()[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  saveSettings({ [key]: value });
}
