<script lang="ts">
  export let matches: Array<{ students: string[]; similarity: number; assignmentId: number }> = [];
</script>

{#if matches.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Plagiaadikattuvusi pole tuvastatud.</p>
  </div>
{:else}
  <div class="card variant-soft-warning overflow-hidden">
    <div class="p-3 bg-warning-200 font-semibold">
      Plagiaadikattuvused ({matches.length})
    </div>
    <div class="divide-y divide-warning-300">
      {#each matches as match, i}
        <div class="p-3 hover:bg-warning-100">
          <div class="flex justify-between items-start">
            <div>
              <span class="font-medium">{match.students.join(' & ')}</span>
              <span class="text-sm text-surface-600 ml-2">#{match.assignmentId}</span>
            </div>
            <span class="badge bg-error-500 text-error-50">{match.similarity}%</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
