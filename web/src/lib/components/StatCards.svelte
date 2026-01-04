<script lang="ts">
  export let totalAssignments: number = 0;
  export let totalSubmissions: number = 0;
  export let totalUngraded: number = 0;
  export let plagiarismMatches: number = 0;
  export let connected: boolean = false;

  $: gradedCount = totalSubmissions - totalUngraded;
  $: gradedPercent = totalSubmissions > 0 ? ((gradedCount / totalSubmissions) * 100).toFixed(0) : '0';
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div class="card p-4 variant-soft-surface">
    <div class="text-sm text-surface-600 mb-1">Ülesanded</div>
    <div class="text-2xl font-bold">{totalAssignments}</div>
  </div>

  <div class="card p-4 variant-soft-surface">
    <div class="text-sm text-surface-600 mb-1">Esitused kokku</div>
    <div class="text-2xl font-bold">{totalSubmissions}</div>
  </div>

  <div class="card p-4 variant-soft-primary">
    <div class="text-sm mb-1">Hindamata</div>
    <div class="text-2xl font-bold">{totalUngraded}</div>
    <div class="text-xs text-surface-600">
      {gradedPercent}% hinnatud
    </div>
  </div>

  <div class="card p-4" class:variant-soft-warning={plagiarismMatches > 0} class:variant-soft-surface={plagiarismMatches === 0}>
    <div class="text-sm mb-1">Plagiaadikattuvused</div>
    <div class="text-2xl font-bold">{plagiarismMatches}</div>
  </div>
</div>

<div class="flex items-center gap-2 mt-4">
  <span
    class="w-3 h-3 rounded-full"
    class:bg-success-500={connected}
    class:bg-error-500={!connected}
  ></span>
  <span class="text-sm text-surface-600">
    {connected ? 'Ühendatud' : 'Ühendus puudub'}
  </span>
</div>
