<script lang="ts">
  import SubmissionRow from './SubmissionRow.svelte';

  export let submissions: Record<string, { status: string; error?: string }> = {};
  export let title: string = 'Esitused';

  $: entries = Object.entries(submissions).map(([key, value]) => {
    const [student, assignmentId] = key.split('/');
    return {
      student,
      assignmentId: parseInt(assignmentId, 10),
      status: value.status,
      error: value.error
    };
  });

  // Sort: in-progress first, then by student name
  $: sortedEntries = entries.sort((a, b) => {
    const inProgressStatuses = ['cloning', 'submitting'];
    const aInProgress = inProgressStatuses.includes(a.status);
    const bInProgress = inProgressStatuses.includes(b.status);

    if (aInProgress && !bInProgress) return -1;
    if (!aInProgress && bInProgress) return 1;
    return a.student.localeCompare(b.student, 'et');
  });
</script>

{#if entries.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Esitusi pole veel töödeldud.</p>
  </div>
{:else}
  <div class="card variant-soft-surface overflow-hidden">
    <div class="p-3 bg-surface-200 font-semibold">
      {title} ({entries.length})
    </div>
    <div class="max-h-96 overflow-y-auto">
      {#each sortedEntries as entry (entry.student + '/' + entry.assignmentId)}
        <SubmissionRow
          student={entry.student}
          assignmentId={entry.assignmentId}
          status={entry.status}
          error={entry.error}
        />
      {/each}
    </div>
  </div>
{/if}
