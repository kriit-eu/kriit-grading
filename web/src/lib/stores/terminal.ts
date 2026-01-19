import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface TerminalState {
  isRunning: boolean;
  isConnected: boolean;
  isVisible: boolean;
  output: string;
}

const initialState: TerminalState = {
  isRunning: false,
  isConnected: false,
  isVisible: false,
  output: ''
};

function createTerminalStore() {
  const { subscribe, set, update } = writable<TerminalState>(initialState);

  let eventSource: EventSource | null = null;

  return {
    subscribe,

    connect() {
      if (!browser) return;
      if (eventSource) return;

      eventSource = new EventSource('/api/terminal/stream');

      eventSource.onopen = () => {
        update(s => ({ ...s, isConnected: true }));
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          this.handleEvent(event);
        } catch (error) {
          console.error('Failed to parse terminal SSE event:', error);
        }
      };

      eventSource.onerror = () => {
        update(s => ({ ...s, isConnected: false }));
      };
    },

    disconnect() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
        update(s => ({ ...s, isConnected: false }));
      }
    },

    handleEvent(event: { type: string; data: unknown }) {
      update(s => {
        switch (event.type) {
          case 'status':
            return { ...s, isRunning: event.data === 'running' };

          case 'buffer':
            // Initial buffer from server
            return { ...s, output: event.data as string };

          case 'output':
            // Append new output
            return { ...s, output: s.output + (event.data as string) };

          default:
            return s;
        }
      });
    },

    async start(command: string = 'claude', cols: number = 80, rows: number = 24) {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', command, cols, rows })
      });
      return response.json();
    },

    async stop() {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      return response.json();
    },

    async sendInput(data: string) {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'input', data })
      });
      return response.json();
    },

    show() {
      update(s => ({ ...s, isVisible: true }));
    },

    hide() {
      update(s => ({ ...s, isVisible: false }));
    },

    toggle() {
      update(s => ({ ...s, isVisible: !s.isVisible }));
    },

    clear() {
      update(s => ({ ...s, output: '' }));
    },

    reset() {
      set(initialState);
    }
  };
}

export const terminalStore = createTerminalStore();

// Derived stores
export const isTerminalRunning = derived(
  terminalStore,
  $s => $s.isRunning
);

export const isTerminalVisible = derived(
  terminalStore,
  $s => $s.isVisible
);
