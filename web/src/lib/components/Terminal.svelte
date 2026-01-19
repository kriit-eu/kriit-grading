<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { terminalStore } from '$lib/stores/terminal';
  import type { Terminal } from 'xterm';
  import type { FitAddon } from '@xterm/addon-fit';

  let terminalEl: HTMLDivElement;
  let term: Terminal | null = null;
  let fitAddon: FitAddon | null = null;

  $: isRunning = $terminalStore.isRunning;
  $: isConnected = $terminalStore.isConnected;
  $: output = $terminalStore.output;

  // Track last written position to avoid duplicate output
  let lastWrittenLength = 0;

  // Write new output to terminal
  $: if (term && output.length > lastWrittenLength) {
    const newContent = output.slice(lastWrittenLength);
    term.write(newContent);
    lastWrittenLength = output.length;
  }

  onMount(async () => {
    // Dynamically import xterm to avoid SSR issues
    const { Terminal } = await import('xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    await import('xterm/css/xterm.css');

    term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b70',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de'
      }
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalEl);
    fitAddon.fit();

    // Handle user input
    term.onData((data) => {
      if (isRunning) {
        terminalStore.sendInput(data);
      }
    });

    // Handle window resize and notify server
    const handleResize = () => {
      if (fitAddon && term) {
        fitAddon.fit();
        // Notify server of new size
        fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resize', cols: term.cols, rows: term.rows })
        }).catch(() => {});
      }
    };
    window.addEventListener('resize', handleResize);

    // Initial resize after a short delay to ensure proper sizing
    setTimeout(handleResize, 100);

    // Connect to SSE stream
    terminalStore.connect();

    // Write existing output
    if (output) {
      term.write(output);
      lastWrittenLength = output.length;
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    terminalStore.disconnect();
    if (term) {
      term.dispose();
      term = null;
    }
  });

  async function startClaude(prompt?: string) {
    if (term) {
      term.clear();
      lastWrittenLength = 0;
      terminalStore.clear();
    }
    const command = prompt ? `claude "${prompt}"` : 'claude';
    // Pass terminal size when starting
    const cols = term?.cols || 80;
    const rows = term?.rows || 24;
    await terminalStore.start(command, cols, rows);
  }

  function stopClaude() {
    terminalStore.stop();
  }
</script>

<div class="terminal-container card bg-surface-900 p-4 rounded-lg">
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-3">
      <h3 class="text-lg font-semibold text-white">Claude Terminal</h3>
      <span class="badge {isConnected ? 'bg-success-500' : 'bg-error-500'} text-xs px-2 py-0.5 rounded">
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      {#if isRunning}
        <span class="badge bg-primary-500 text-xs px-2 py-0.5 rounded animate-pulse">
          Running
        </span>
      {/if}
    </div>
    <div class="flex gap-2">
      {#if !isRunning}
        <button
          type="button"
          class="btn btn-sm bg-primary-500 text-white hover:bg-primary-600"
          on:click={() => startClaude('Hinda kõik esitused')}
        >
          Hinda
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-sm bg-error-500 text-white hover:bg-error-600"
          on:click={stopClaude}
        >
          Stop
        </button>
      {/if}
    </div>
  </div>

  <div
    bind:this={terminalEl}
    class="terminal-element rounded overflow-hidden"
    style="height: calc(100vh - 200px); min-height: 400px;"
  ></div>
</div>

<style>
  .terminal-container {
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .terminal-element {
    background: #1e1e2e;
  }

  :global(.xterm) {
    padding: 8px;
  }
</style>
