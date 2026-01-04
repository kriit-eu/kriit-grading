<script lang="ts">
  export let progress: number = 0;
  export let total: number = 0;
  export let completed: number = 0;
  export let failed: number = 0;
  export let operation: string | null = null;

  const operationLabels: Record<string, string> = {
    list: 'Ülesannete laadimine...',
    clone: 'Repositooriumide kloonimine...',
    plagiarism: 'Plagiaadikontroll...',
    submit: 'Tagasiside esitamine...'
  };

  $: label = operation ? operationLabels[operation] || operation : 'Ootel';
  $: percentage = Math.min(100, Math.max(0, progress));
</script>

<div class="card p-4 variant-soft-surface">
  <div class="flex justify-between items-center mb-2">
    <span class="font-semibold">{label}</span>
    {#if total > 0}
      <span class="text-sm text-surface-600">
        {completed}/{total}
        {#if failed > 0}
          <span class="text-error-500">({failed} ebaõnnestunud)</span>
        {/if}
      </span>
    {/if}
  </div>

  <div class="w-full bg-surface-300 rounded-full h-4 overflow-hidden">
    <div
      class="h-full transition-all duration-300 ease-out"
      class:bg-primary-500={failed === 0}
      class:bg-warning-500={failed > 0}
      style="width: {percentage}%"
    ></div>
  </div>

  {#if total > 0}
    <div class="text-right text-sm mt-1 text-surface-600">
      {percentage.toFixed(0)}%
    </div>
  {/if}
</div>
