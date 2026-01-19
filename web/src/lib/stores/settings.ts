import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Environment = 'dev' | 'prod';

export interface Settings {
  environment: Environment;
  devUrl: string;
  devApiKey: string;
  prodUrl: string;
  prodApiKey: string;
}

const defaultSettings: Settings = {
  environment: 'dev',
  devUrl: 'http://localhost:8000',
  devApiKey: 'demo',
  prodUrl: 'https://kriit.vikk.ee',
  prodApiKey: ''
};

const STORAGE_KEY = 'kriit-grading-settings';

function loadSettings(): Settings {
  if (!browser) return defaultSettings;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
}

function saveSettings(settings: Settings): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(loadSettings());

  return {
    subscribe,

    setEnvironment(env: Environment) {
      update(s => {
        const newSettings = { ...s, environment: env };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setDevUrl(url: string) {
      update(s => {
        const newSettings = { ...s, devUrl: url };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setDevApiKey(key: string) {
      update(s => {
        const newSettings = { ...s, devApiKey: key };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setProdUrl(url: string) {
      update(s => {
        const newSettings = { ...s, prodUrl: url };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    setProdApiKey(key: string) {
      update(s => {
        const newSettings = { ...s, prodApiKey: key };
        saveSettings(newSettings);
        return newSettings;
      });
    },

    reset() {
      saveSettings(defaultSettings);
      set(defaultSettings);
    }
  };
}

export const settingsStore = createSettingsStore();

// Derived helpers
export function getActiveUrl(settings: Settings): string {
  return settings.environment === 'dev' ? settings.devUrl : settings.prodUrl;
}

export function getActiveApiKey(settings: Settings): string {
  return settings.environment === 'dev' ? settings.devApiKey : settings.prodApiKey;
}
