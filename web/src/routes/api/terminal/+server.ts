import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  startTerminal,
  stopTerminal,
  writeToTerminal,
  resizeTerminal,
  getTerminalStatus
} from '$lib/server/terminal';

// GET /api/terminal - Get terminal status
export const GET: RequestHandler = async () => {
  const status = getTerminalStatus();
  return json(status);
};

// POST /api/terminal - Start terminal or send input
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  if (body.action === 'start') {
    const command = body.command || 'claude';
    const success = await startTerminal(command);
    return json({ success, message: success ? 'Terminal started' : 'Terminal already running' });
  }

  if (body.action === 'stop') {
    const success = stopTerminal();
    return json({ success, message: success ? 'Terminal stopped' : 'No terminal running' });
  }

  if (body.action === 'input') {
    const success = writeToTerminal(body.data || '');
    return json({ success });
  }

  if (body.action === 'resize') {
    const success = resizeTerminal(body.cols || 80, body.rows || 24);
    return json({ success });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
