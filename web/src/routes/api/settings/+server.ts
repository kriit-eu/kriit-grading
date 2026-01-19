import type { RequestHandler } from './$types';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { json } from '@sveltejs/kit';

// .env file is in project root (parent of 'web' directory)
const envPath = resolve(process.cwd(), '..', '.env');

interface EnvSettings {
  apiUrl: string;
  apiKey: string;
  autoApproveHighConfidence?: boolean;
}

function parseEnvFile(): Record<string, string> {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }

  return result;
}

function writeEnvFile(env: Record<string, string>): void {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  writeFileSync(envPath, lines.join('\n') + '\n');
}

export const GET: RequestHandler = async () => {
  const env = parseEnvFile();

  return json({
    apiUrl: env.KRIIT_API_URL || '',
    apiKey: env.KRIIT_API_KEY || '',
    autoApproveHighConfidence: env.AUTO_APPROVE_HIGH_CONFIDENCE !== 'false'
  });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as EnvSettings;

    if (!body.apiUrl) {
      return json({ error: 'API URL is required' }, { status: 400 });
    }

    if (!body.apiKey) {
      return json({ error: 'API key is required' }, { status: 400 });
    }

    // Read existing env to preserve other settings
    const env = parseEnvFile();

    // Update the relevant settings
    env.KRIIT_API_URL = body.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    env.KRIIT_API_KEY = body.apiKey;

    if (body.autoApproveHighConfidence !== undefined) {
      env.AUTO_APPROVE_HIGH_CONFIDENCE = body.autoApproveHighConfidence ? 'true' : 'false';
    }

    writeEnvFile(env);

    return json({ success: true, message: 'Settings saved' });
  } catch (e) {
    console.error('Failed to save settings:', e);
    return json(
      { error: e instanceof Error ? e.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
};
