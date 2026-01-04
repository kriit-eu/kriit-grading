<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';

  export let student: string;
  export let assignmentId: number;
  export let status: string;
  export let error: string | undefined = undefined;
</script>

<div class="flex items-center justify-between p-3 border-b border-surface-300 hover:bg-surface-100">
  <div class="flex-1">
    <span class="font-medium">{student}</span>
    <span class="text-sm text-surface-500 ml-2">#{assignmentId}</span>
  </div>

  <div class="flex items-center gap-2">
    <StatusBadge {status} />
  </div>
</div>

{#if error}
  <div class="px-3 py-2 bg-error-50 text-error-700 text-sm border-b border-surface-300">
    {error}
  </div>
{/if}
