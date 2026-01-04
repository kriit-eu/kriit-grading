<script lang="ts">
  import type { FlatSubmission, Message } from '$lib/stores/grading';
  import { gradingStore } from '$lib/stores/grading';
  import SubmissionConversation from './SubmissionConversation.svelte';

  export let submissions: FlatSubmission[] = [];

  // Track expanded state per submission - all start expanded by default
  let expandedSubmissions: Set<string> = new Set(
    submissions.map(s => getSubmissionKey(s))
  );

  // Update expanded set when submissions change (add new ones as expanded)
  $: {
    for (const sub of submissions) {
      const key = getSubmissionKey(sub);
      if (!expandedSubmissions.has(key)) {
        expandedSubmissions.add(key);
        expandedSubmissions = expandedSubmissions;
      }
    }
  }

  function getSubmissionKey(submission: FlatSubmission): string {
    return `${submission.studentName}/${submission.assignmentId}`;
  }

  function toggleExpanded(key: string) {
    if (expandedSubmissions.has(key)) {
      expandedSubmissions.delete(key);
    } else {
      expandedSubmissions.add(key);
    }
    expandedSubmissions = expandedSubmissions; // Trigger reactivity
  }

  function getMessages(key: string): Message[] {
    return $gradingStore.messages[key] || [];
  }

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
    <p class="text-sm text-surface-500 mt-2">Käivita <code class="bg-surface-200 px-1 rounded">cd kriit-grading && claude "Hinda kõik esitused"</code></p>
  </div>
{:else}
  <div class="card variant-soft-surface overflow-hidden">
    {#each submissions as submission (submission.userId + '-' + submission.assignmentId)}
      {@const key = getSubmissionKey(submission)}
      {@const messages = getMessages(key)}
      {@const isExpanded = expandedSubmissions.has(key)}
      {@const hasMessages = messages.length > 0}

      <div class="border-b border-surface-300">
        <!-- Submission row -->
        <button
          class="w-full text-left p-3 flex items-center gap-3 hover:bg-surface-200 transition-colors"
          class:cursor-pointer={hasMessages}
          class:cursor-default={!hasMessages}
          on:click={() => hasMessages && toggleExpanded(key)}
        >
          <!-- Expand indicator -->
          <span class="w-4 text-surface-400">
            {#if hasMessages}
              {#if isExpanded}▼{:else}►{/if}
            {/if}
          </span>

          <!-- Student name -->
          <span class="font-medium flex-shrink-0 w-36 truncate">{submission.studentName}</span>

          <!-- Assignment -->
          <span class="text-surface-600 flex-1 truncate">
            <span class="text-surface-400">#{submission.assignmentId}</span>
            {submission.assignmentName}
          </span>

          <!-- Date -->
          <span class="text-surface-500 text-sm flex-shrink-0 w-32">{formatDate(submission.submittedAt)}</span>

          <!-- Status -->
          <span class="flex-shrink-0">
            {#if submission.isGraded}
              <span class="badge bg-success-500 text-white">Hinnatud</span>
            {:else}
              <span class="badge bg-warning-500 text-warning-900">Hindamata</span>
            {/if}
          </span>

          <!-- Message count badge -->
          {#if hasMessages}
            <span class="badge bg-surface-300 text-surface-600 text-xs">{messages.length}</span>
          {/if}
        </button>

        <!-- Conversation (expanded) -->
        {#if isExpanded && hasMessages}
          <SubmissionConversation {messages} />
        {/if}
      </div>
    {/each}
  </div>
{/if}
