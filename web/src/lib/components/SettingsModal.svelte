<script lang="ts">
  import { settingsStore, getActiveUrl, getActiveApiKey, type Environment } from '$lib/stores/settings';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let { open = $bindable(false) } = $props();

  let settings = $state($settingsStore);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);
  let dialogEl: HTMLDialogElement;

  settingsStore.subscribe(value => {
    settings = value;
  });

  $effect(() => {
    if (browser && dialogEl) {
      if (open) {
        dialogEl.showModal();
      } else {
        dialogEl.close();
      }
    }
  });

  function handleClose() {
    open = false;
  }

  function handleEnvironmentChange(env: Environment) {
    settingsStore.setEnvironment(env);
  }

  function handleDevUrlChange(e: Event) {
    settingsStore.setDevUrl((e.target as HTMLInputElement).value);
  }

  function handleDevApiKeyChange(e: Event) {
    settingsStore.setDevApiKey((e.target as HTMLInputElement).value);
  }

  function handleProdUrlChange(e: Event) {
    settingsStore.setProdUrl((e.target as HTMLInputElement).value);
  }

  function handleProdApiKeyChange(e: Event) {
    settingsStore.setProdApiKey((e.target as HTMLInputElement).value);
  }

  async function applySettings() {
    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: getActiveUrl(settings),
          apiKey: getActiveApiKey(settings)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      saveSuccess = true;
      setTimeout(() => {
        saveSuccess = false;
      }, 2000);
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      saving = false;
    }
  }
</script>

<dialog
  bind:this={dialogEl}
  onclose={handleClose}
  class="modal-dialog"
>
  <div class="p-6 w-full max-w-md bg-surface-100 dark:bg-surface-800 rounded-lg">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">Seaded</h2>
      <button
        class="btn-icon btn-icon-sm variant-ghost-surface"
        onclick={() => open = false}
        aria-label="Sulge"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- Environment Toggle -->
    <div class="mb-6">
      <div class="text-sm font-medium mb-2">Keskkond</div>
      <div class="flex gap-2">
        <button
          class="btn flex-1 {settings.environment === 'dev' ? 'variant-filled-primary' : 'variant-ghost-surface'}"
          onclick={() => handleEnvironmentChange('dev')}
        >
          Dev
        </button>
        <button
          class="btn flex-1 {settings.environment === 'prod' ? 'variant-filled-warning' : 'variant-ghost-surface'}"
          onclick={() => handleEnvironmentChange('prod')}
        >
          Prod
        </button>
      </div>
    </div>

    <!-- Dev Settings -->
    <fieldset class="mb-4 p-3 rounded border border-surface-300 dark:border-surface-600 {settings.environment === 'dev' ? 'opacity-100' : 'opacity-50'}">
      <legend class="px-2 text-sm font-medium">Dev</legend>

      <div class="mb-2">
        <div class="text-sm mb-1">URL</div>
        <input
          type="url"
          class="input w-full"
          value={settings.devUrl}
          oninput={handleDevUrlChange}
          placeholder="http://localhost:8000"
        />
      </div>

      <div>
        <div class="text-sm mb-1">API Key</div>
        <input
          type="text"
          class="input w-full"
          value={settings.devApiKey}
          oninput={handleDevApiKeyChange}
          placeholder="demo"
        />
      </div>
    </fieldset>

    <!-- Prod Settings -->
    <fieldset class="mb-6 p-3 rounded border border-surface-300 dark:border-surface-600 {settings.environment === 'prod' ? 'opacity-100' : 'opacity-50'}">
      <legend class="px-2 text-sm font-medium">Prod</legend>

      <div class="mb-2">
        <div class="text-sm mb-1">URL</div>
        <input
          type="url"
          class="input w-full"
          value={settings.prodUrl}
          oninput={handleProdUrlChange}
          placeholder="https://kriit.vikk.ee"
        />
      </div>

      <div>
        <div class="text-sm mb-1">API Key</div>
        <input
          type="password"
          class="input w-full"
          value={settings.prodApiKey}
          oninput={handleProdApiKeyChange}
          placeholder="API key"
        />
      </div>
    </fieldset>

    <!-- Active Config Display -->
    <div class="mb-4 p-3 rounded bg-surface-200 dark:bg-surface-700 text-sm">
      <div class="font-medium mb-1">Aktiivne konfiguratsioon:</div>
      <div class="text-surface-600 dark:text-surface-400 break-all">
        {getActiveUrl(settings)}
      </div>
    </div>

    <!-- Error/Success Messages -->
    {#if saveError}
      <div class="alert variant-filled-error mb-4 p-3 rounded">
        {saveError}
      </div>
    {/if}

    {#if saveSuccess}
      <div class="alert variant-filled-success mb-4 p-3 rounded">
        Seaded salvestatud!
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex gap-2 justify-end">
      <button
        class="btn variant-ghost-surface"
        onclick={() => open = false}
      >
        Tühista
      </button>
      <button
        class="btn variant-filled-primary"
        onclick={applySettings}
        disabled={saving}
      >
        {#if saving}
          Salvestan...
        {:else}
          Rakenda
        {/if}
      </button>
    </div>
  </div>
</dialog>

<style>
  .modal-dialog {
    padding: 0;
    border: none;
    border-radius: 0.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-width: 28rem;
    width: 100%;
  }

  .modal-dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }

  .modal-dialog[open] {
    display: flex;
  }
</style>
