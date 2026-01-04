/**
 * Sends event notifications to the web server.
 * If the server is not running, silently continues (graceful fallback).
 *
 * @param {string} type - Event type (e.g., 'list:start', 'clone:progress')
 * @param {object} data - Event payload data
 */
export async function notify(type, data = {}) {
  const port = process.env.WEB_PORT || 3000;
  try {
    await fetch(`http://localhost:${port}/api/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
      })
    });
  } catch {
    // Server is not running, continue silently
  }
}
