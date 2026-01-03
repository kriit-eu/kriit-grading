import { test, expect, describe, beforeEach, afterEach } from 'bun:test';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.KRIIT_API_URL;
    delete process.env.KRIIT_API_KEY;
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = { ...originalEnv };
  });

  test('loadConfig throws when KRIIT_API_URL is missing', async () => {
    process.env.KRIIT_API_KEY = 'test-key';

    // Re-import to get fresh module state
    const { loadConfig } = await import('../src/config.js');

    expect(() => loadConfig()).toThrow('KRIIT_API_URL not set');
  });

  test('loadConfig throws when KRIIT_API_KEY is missing', async () => {
    process.env.KRIIT_API_URL = 'https://example.com';

    const { loadConfig } = await import('../src/config.js');

    expect(() => loadConfig()).toThrow('KRIIT_API_KEY not set');
  });

  test('loadConfig returns config when both env vars are set', async () => {
    process.env.KRIIT_API_URL = 'https://kriit.vikk.ee';
    process.env.KRIIT_API_KEY = 'my-secret-key';

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig();

    expect(config.apiUrl).toBe('https://kriit.vikk.ee');
    expect(config.apiKey).toBe('my-secret-key');
  });

  test('loadConfig removes trailing slash from URL', async () => {
    process.env.KRIIT_API_URL = 'https://kriit.vikk.ee/';
    process.env.KRIIT_API_KEY = 'my-secret-key';

    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig();

    expect(config.apiUrl).toBe('https://kriit.vikk.ee');
  });

  test('getWorkDir returns correct path', async () => {
    const { getWorkDir } = await import('../src/config.js');
    const workDir = getWorkDir();

    expect(workDir).toContain('student-grading');
  });

  test('getPlagiarismReportsDir returns correct path', async () => {
    const { getPlagiarismReportsDir } = await import('../src/config.js');
    const reportsDir = getPlagiarismReportsDir();

    expect(reportsDir).toContain('plagiarism-reports');
  });

  test('getBatchFilePath returns correct path', async () => {
    const { getBatchFilePath } = await import('../src/config.js');
    const batchFile = getBatchFilePath();

    expect(batchFile).toContain('grading-batch.json');
  });
});
