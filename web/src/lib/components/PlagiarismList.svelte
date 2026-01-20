<script lang="ts">
  import { gradingStore } from '$lib/stores/grading';

  export let matches: Array<{ students: string[]; similarity: number; assignmentId: number }> = [];

  function getAssignmentName(assignmentId: number): string {
    const assignment = $gradingStore.assignments.find(a => a.id === assignmentId);
    return assignment?.name || `#${assignmentId}`;
  }
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
              {#if $gradingStore.kriitUrl}
                <a
                  href="{$gradingStore.kriitUrl}/assignments/{match.assignmentId}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-primary-600 hover:text-primary-800 ml-2"
                >{getAssignmentName(match.assignmentId)} ↗</a>
              {:else}
                <span class="text-sm text-surface-600 ml-2">{getAssignmentName(match.assignmentId)}</span>
              {/if}
            </div>
            <span class="badge bg-error-500 text-error-50">{match.similarity}%</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
