<script lang="ts">
  export let status: string;

  const statusConfig: Record<string, { text: string; classes: string }> = {
    // Clone statuses
    cloning: { text: 'Kloonimine...', classes: 'bg-warning-500 text-warning-900' },
    done: { text: 'Valmis', classes: 'bg-success-500 text-success-900' },
    skipped: { text: 'Vahele jäetud', classes: 'bg-surface-400 text-surface-900' },
    failed: { text: 'Ebaõnnestus', classes: 'bg-error-500 text-error-900' },
    // Submit statuses
    submitting: { text: 'Esitamine...', classes: 'bg-warning-500 text-warning-900' },
    error: { text: 'Viga', classes: 'bg-error-500 text-error-900' },
    // Default
    pending: { text: 'Ootel', classes: 'bg-surface-300 text-surface-700' }
  };

  $: config = statusConfig[status] || statusConfig.pending;
</script>

<span class="badge {config.classes} text-xs font-medium px-2 py-1 rounded">
  {config.text}
</span>
