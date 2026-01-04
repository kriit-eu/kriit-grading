import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test';
import { spawn } from 'child_process';

/**
 * E2E tests for the grading dashboard flow.
 * Tests that CLI events reach the web server and update state.
 */

const SERVER_PORT = 3001; // Use different port to avoid conflicts
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let serverProcess;

describe('grading flow e2e', () => {
  beforeAll(async () => {
    // Build the web server
    const buildProcess = Bun.spawn(['bun', 'run', 'build'], {
      cwd: `${import.meta.dir}/../../web`,
      stdout: 'pipe',
      stderr: 'pipe'
    });
    await buildProcess.exited;

    // Start server on test port
    serverProcess = spawn('bun', ['build/index.js'], {
      cwd: `${import.meta.dir}/../../web`,
      env: { ...process.env, PORT: SERVER_PORT.toString() },
      stdio: 'pipe'
    });

    // Wait for server to be ready
    let retries = 20;
    while (retries > 0) {
      try {
        const response = await fetch(SERVER_URL);
        if (response.ok) break;
      } catch {
        // Server not ready yet
      }
      await new Promise(r => setTimeout(r, 250));
      retries--;
    }

    if (retries === 0) {
      throw new Error('Server failed to start');
    }
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('emit endpoint', () => {
    test('accepts valid events and returns success', async () => {
      const response = await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'list:start',
          data: {},
          timestamp: new Date().toISOString()
        })
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('rejects events without type', async () => {
      const response = await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { foo: 'bar' }
        })
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('type');
    });

    test('handles list:complete with assignments', async () => {
      const response = await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'list:complete',
          data: {
            assignments: [
              { id: 1, name: 'SQL Basics', submissions: 10, ungraded: 5 },
              { id: 2, name: 'Python Intro', submissions: 8, ungraded: 3 }
            ]
          },
          timestamp: new Date().toISOString()
        })
      });

      expect(response.status).toBe(200);
    });

    test('handles clone:progress events', async () => {
      // Send clone:start first
      await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clone:start',
          data: { total: 3 },
          timestamp: new Date().toISOString()
        })
      });

      // Send progress events
      const statuses = ['cloning', 'done', 'failed', 'skipped'];
      for (const status of statuses) {
        const response = await fetch(`${SERVER_URL}/api/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clone:progress',
            data: { student: `Student ${status}`, assignmentId: 1, status },
            timestamp: new Date().toISOString()
          })
        });
        expect(response.status).toBe(200);
      }
    });

    test('handles plagiarism:match events', async () => {
      const response = await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'plagiarism:match',
          data: {
            students: ['Alice', 'Bob'],
            similarity: 95,
            assignmentId: 42
          },
          timestamp: new Date().toISOString()
        })
      });

      expect(response.status).toBe(200);
    });

    test('handles submit:progress events', async () => {
      await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'submit:start',
          data: { total: 5 },
          timestamp: new Date().toISOString()
        })
      });

      const response = await fetch(`${SERVER_URL}/api/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'submit:progress',
          data: { student: 'Test Student', assignmentId: 1, status: 'done' },
          timestamp: new Date().toISOString()
        })
      });

      expect(response.status).toBe(200);
    });

    test('handles error events', async () => {
      const errorTypes = ['list:error', 'clone:error', 'plagiarism:error', 'submit:error'];

      for (const type of errorTypes) {
        const response = await fetch(`${SERVER_URL}/api/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            data: { message: `Test error for ${type}` },
            timestamp: new Date().toISOString()
          })
        });
        expect(response.status).toBe(200);
      }
    });
  });

  describe('SSE events endpoint', () => {
    test('returns event-stream content type', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      try {
        const response = await fetch(`${SERVER_URL}/api/events`, {
          signal: controller.signal
        });

        expect(response.headers.get('content-type')).toBe('text/event-stream');
        expect(response.headers.get('cache-control')).toBe('no-cache');
      } catch (e) {
        // AbortError is expected
        if (e.name !== 'AbortError') throw e;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    test('sends initial state:full event', async () => {
      const controller = new AbortController();

      try {
        const response = await fetch(`${SERVER_URL}/api/events`, {
          signal: controller.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Read first chunk
        const { value } = await reader.read();
        const text = decoder.decode(value);

        // Should contain state:full event
        expect(text).toContain('data:');
        expect(text).toContain('state:full');

        controller.abort();
      } catch (e) {
        if (e.name !== 'AbortError') throw e;
      }
    });
  });

  describe('full workflow simulation', () => {
    test('complete grading flow sends all events', async () => {
      const events = [
        { type: 'list:start', data: {} },
        { type: 'list:complete', data: { assignments: [{ id: 1, name: 'Test', submissions: 2, ungraded: 2 }] } },
        { type: 'clone:start', data: { total: 2 } },
        { type: 'clone:progress', data: { student: 'Alice', assignmentId: 1, status: 'cloning' } },
        { type: 'clone:progress', data: { student: 'Alice', assignmentId: 1, status: 'done' } },
        { type: 'clone:progress', data: { student: 'Bob', assignmentId: 1, status: 'cloning' } },
        { type: 'clone:progress', data: { student: 'Bob', assignmentId: 1, status: 'done' } },
        { type: 'clone:complete', data: { success: 2, failed: 0, skipped: 0 } },
        { type: 'plagiarism:start', data: { totalAssignments: 1 } },
        { type: 'plagiarism:complete', data: { totalMatches: 0 } },
        { type: 'submit:start', data: { total: 2 } },
        { type: 'submit:progress', data: { student: 'Alice', assignmentId: 1, status: 'submitting' } },
        { type: 'submit:progress', data: { student: 'Alice', assignmentId: 1, status: 'done' } },
        { type: 'submit:progress', data: { student: 'Bob', assignmentId: 1, status: 'submitting' } },
        { type: 'submit:progress', data: { student: 'Bob', assignmentId: 1, status: 'done' } },
        { type: 'submit:complete', data: { success: 2, failed: 0 } }
      ];

      for (const event of events) {
        const response = await fetch(`${SERVER_URL}/api/emit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            timestamp: new Date().toISOString()
          })
        });
        expect(response.status).toBe(200);
      }
    });
  });
});

describe('notify helper integration', () => {
  test('notify sends event to running server', async () => {
    // Import notify with test port
    process.env.WEB_PORT = SERVER_PORT.toString();

    // Clear module cache to pick up new env var
    delete require.cache[require.resolve('../../src/lib/notify.js')];
    const { notify } = await import('../../src/lib/notify.js');

    // This should not throw
    await notify('test:event', { foo: 'bar' });

    // Verify by checking emit endpoint received something
    // (We can't directly verify but at least it didn't crash)
  });

  test('notify does not throw when server is unavailable', async () => {
    process.env.WEB_PORT = '59999'; // Port that's definitely not running

    delete require.cache[require.resolve('../../src/lib/notify.js')];
    const { notify } = await import('../../src/lib/notify.js');

    // Should not throw
    await expect(notify('test:event', { data: 'test' })).resolves.toBeUndefined();
  });
});
