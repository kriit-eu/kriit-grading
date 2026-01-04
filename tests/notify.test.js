import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';

describe('notify', () => {
  let originalFetch;
  let mockFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = mock(() => Promise.resolve({ ok: true }));
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('notify sends POST request with correct data', async () => {
    const { notify } = await import('../src/lib/notify.js');

    await notify('test:event', { foo: 'bar' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Check URL uses configured port (WEB_PORT env var) or default 3000
    const expectedPort = process.env.WEB_PORT || '3000';
    expect(url).toBe(`http://localhost:${expectedPort}/api/emit`);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.type).toBe('test:event');
    expect(body.data).toEqual({ foo: 'bar' });
    expect(body.timestamp).toBeDefined();
  });

  test('notify does not throw when server is unavailable', async () => {
    global.fetch = mock(() => Promise.reject(new Error('ECONNREFUSED')));

    const { notify } = await import('../src/lib/notify.js');

    // Should not throw
    await expect(notify('test:event')).resolves.toBeUndefined();
  });

  test('notify includes ISO timestamp', async () => {
    const { notify } = await import('../src/lib/notify.js');

    await notify('test:event');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // ISO timestamp format check
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('notify works with empty data', async () => {
    const { notify } = await import('../src/lib/notify.js');

    await notify('empty:event');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.type).toBe('empty:event');
    expect(body.data).toEqual({});
  });
});
