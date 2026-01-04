<script lang="ts">
  import type { FlatSubmission } from '$lib/stores/grading';

  export let submissions: FlatSubmission[] = [];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '–';
    const date = new Date(dateStr);
    return date.toLocaleString('et-EE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

{#if submissions.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Esitusi pole veel laaditud.</p>
    <p class="text-sm text-surface-500 mt-2">Käivita <code class="bg-surface-200 px-1 rounded">bun list</code> terminalis.</p>
  </div>
{:else}
  <div class="card variant-soft-surface overflow-hidden">
    <table class="table table-hover w-full">
      <thead>
        <tr class="bg-surface-200">
          <th class="text-left p-3">Õpilane</th>
          <th class="text-left p-3">Ülesanne</th>
          <th class="text-left p-3">Esitatud</th>
          <th class="text-right p-3">Staatus</th>
        </tr>
      </thead>
      <tbody>
        {#each submissions as submission (submission.userId + '-' + submission.assignmentId)}
          <tr class="border-b border-surface-300">
            <td class="p-3 font-medium">{submission.studentName}</td>
            <td class="p-3 text-surface-600">
              <span class="text-surface-400">#{submission.assignmentId}</span>
              {submission.assignmentName}
            </td>
            <td class="p-3 text-surface-500 text-sm">{formatDate(submission.submittedAt)}</td>
            <td class="p-3 text-right">
              {#if submission.isGraded}
                <span class="badge bg-success-500 text-white">Hinnatud</span>
              {:else}
                <span class="badge bg-warning-500 text-warning-900">Hindamata</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
