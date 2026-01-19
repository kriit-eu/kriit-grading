/**
 * Terminal manager for running Claude in a PTY.
 * Uses node-pty for proper pseudo-terminal support.
 * Broadcasts to SSE clients (same pattern as state.ts).
 */

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

// SSE client callback type
type SSEClient = (event: { type: string; data: unknown }) => void;

interface TerminalState {
  process: IPty | null;
  clients: Set<SSEClient>;
  buffer: string[];
  isRunning: boolean;
}

const state: TerminalState = {
  process: null,
  clients: new Set(),
  buffer: [],
  isRunning: false
};

const MAX_BUFFER_SIZE = 500;

function broadcast(type: string, data: unknown): void {
  for (const client of state.clients) {
    try {
      client({ type, data });
    } catch {
      state.clients.delete(client);
    }
  }
}

function appendOutput(data: string): void {
  // Add to buffer for new clients
  state.buffer.push(data);
  if (state.buffer.length > MAX_BUFFER_SIZE) {
    state.buffer.shift();
  }
  broadcast('output', data);
}

export function registerClient(callback: SSEClient): () => void {
  state.clients.add(callback);

  // Send current buffer to new client
  if (state.buffer.length > 0) {
    callback({ type: 'buffer', data: state.buffer.join('') });
  }

  // Send current status
  callback({ type: 'status', data: state.isRunning ? 'running' : 'stopped' });

  return () => {
    state.clients.delete(callback);
  };
}

export async function startTerminal(command: string = 'claude', cols: number = 80, rows: number = 24): Promise<boolean> {
  if (state.isRunning && state.process) {
    return false; // Already running
  }

  // Clear buffer for new session
  state.buffer = [];

  try {
    // Parse command into args - handle quoted strings
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    for (const char of command) {
      if (char === '"' && !inQuote) {
        inQuote = true;
      } else if (char === '"' && inQuote) {
        inQuote = false;
      } else if (char === ' ' && !inQuote) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) args.push(current);

    const cmd = args.shift() || 'claude';

    // Spawn PTY process with actual terminal size
    state.process = pty.spawn(cmd, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.cwd().replace(/\/web$/, ''), // Run in project root, not web/
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1'
      } as Record<string, string>
    });

    state.isRunning = true;
    broadcast('status', 'running');

    // Handle PTY data
    state.process.onData((data: string) => {
      appendOutput(data);
    });

    // Handle PTY exit
    state.process.onExit(({ exitCode }) => {
      state.isRunning = false;
      state.process = null;
      appendOutput(`\r\n[Process exited with code ${exitCode}]\r\n`);
      broadcast('status', 'stopped');
    });

    return true;
  } catch (error) {
    state.isRunning = false;
    state.process = null;
    appendOutput(`\r\n[Error starting process: ${error}]\r\n`);
    broadcast('status', 'stopped');
    return false;
  }
}

export function writeToTerminal(data: string): boolean {
  if (!state.isRunning || !state.process) {
    return false;
  }

  try {
    state.process.write(data);
    return true;
  } catch {
    return false;
  }
}

export function resizeTerminal(cols: number, rows: number): boolean {
  if (!state.isRunning || !state.process) {
    return false;
  }

  try {
    state.process.resize(cols, rows);
    return true;
  } catch {
    return false;
  }
}

export function stopTerminal(): boolean {
  if (!state.process) {
    return false;
  }

  try {
    state.process.kill();
    state.isRunning = false;
    state.process = null;
    broadcast('status', 'stopped');
    return true;
  } catch {
    return false;
  }
}

export function getTerminalStatus(): { isRunning: boolean; clientCount: number } {
  return {
    isRunning: state.isRunning,
    clientCount: state.clients.size
  };
}
