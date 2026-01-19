<script lang="ts">
  import type { FlatSubmission, Message } from '$lib/stores/grading';
  import { gradingStore } from '$lib/stores/grading';
  import SubmissionConversation from './SubmissionConversation.svelte';

  export let submissions: FlatSubmission[] = [];

  // Track expanded state per submission - all start collapsed
  let expandedSubmissions: Set<string> = new Set();

  // Auto-expand submissions that have errors
  $: {
    for (const sub of submissions) {
      const key = getSubmissionKey(sub);
      const messages = $gradingStore.messages[key] || [];
      const cloneStatus = $gradingStore.submissions[key];
      const hasError = messages.some(m => m.failed) || cloneStatus?.status === 'failed';

      if (hasError && !expandedSubmissions.has(key)) {
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

  function getStatusBadge(submission: FlatSubmission, cloneStatus: { status: string; error?: string } | undefined, messages: Message[]): { text: string; class: string } {
    // Check for errors first
    if (cloneStatus?.status === 'failed') {
      return { text: 'Viga', class: 'bg-error-500 text-white' };
    }
    if (messages.some(m => m.failed)) {
      return { text: 'Viga', class: 'bg-error-500 text-white' };
    }

    // Check if graded
    if (submission.isGraded) {
      return { text: 'Valmis', class: 'bg-success-500 text-white' };
    }

    // Check clone status
    if (cloneStatus?.status === 'cloning') {
      return { text: 'Kloonin...', class: 'bg-tertiary-500 text-white' };
    }

    // Check last message action for current activity
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      if (lastMessage.action.includes('Hindan') || lastMessage.action.includes('Analüüsin')) {
        return { text: 'Hindamisel...', class: 'bg-tertiary-500 text-white' };
      }
      if (lastMessage.success) {
        return { text: 'Kloonitud', class: 'bg-surface-400 text-white' };
      }
    }

    if (cloneStatus?.status === 'done' || cloneStatus?.status === 'skipped') {
      return { text: 'Kloonitud', class: 'bg-surface-400 text-white' };
    }

    // Default - waiting
    return { text: 'Hindamata', class: 'bg-warning-500 text-warning-900' };
  }
</script>

{#if submissions.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Esitusi pole veel laaditud.</p>
    <p class="text-sm text-surface-500 mt-2">Käivita <code class="bg-surface-200 px-1 rounded">claude "Hinda kõik esitused"</code></p>
  </div>
{:else}
  <div class="card variant-soft-surface overflow-hidden">
    {#each submissions as submission (submission.userId + '-' + submission.assignmentId)}
      {@const key = getSubmissionKey(submission)}
      {@const messages = $gradingStore.messages[key] || []}
      {@const cloneStatus = $gradingStore.submissions[key]}
      {@const isExpanded = expandedSubmissions.has(key)}
      {@const hasMessages = messages.length > 0}
      {@const statusBadge = getStatusBadge(submission, cloneStatus, messages)}
      {@const hasError = statusBadge.text === 'Viga'}

      <div class="border-b border-surface-300 last:border-b-0">
        <!-- Submission row -->
        <button
          class="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-surface-200 transition-colors"
          class:cursor-pointer={hasMessages}
          class:cursor-default={!hasMessages}
          class:bg-error-50={hasError}
          on:click={() => hasMessages && toggleExpanded(key)}
        >
          <!-- Expand indicator -->
          <span class="w-4 text-surface-400 flex-shrink-0">
            {#if hasMessages}
              {#if isExpanded}▼{:else}►{/if}
            {/if}
          </span>

          <!-- Student name -->
          <span class="font-medium flex-shrink-0 w-36 truncate">{submission.studentName}</span>

          <!-- Assignment -->
          <span class="text-surface-600 flex-1 truncate text-sm">
            <span class="text-surface-400">#{submission.assignmentId}</span>
            {submission.assignmentName}
          </span>

          <!-- Date -->
          <span class="text-surface-500 text-xs flex-shrink-0">{formatDate(submission.submittedAt)}</span>

          <!-- Status badge -->
          <span class="flex-shrink-0">
            {#if statusBadge.text === 'Hindamata' && $gradingStore.kriitUrl}
              <a
                href="{$gradingStore.kriitUrl}/assignments/{submission.assignmentId}/students/{submission.userId}"
                target="_blank"
                rel="noopener noreferrer"
                class="badge {statusBadge.class} hover:opacity-80 transition-opacity"
                on:click|stopPropagation
              >{statusBadge.text} ↗</a>
            {:else}
              <span class="badge {statusBadge.class}">{statusBadge.text}</span>
            {/if}
          </span>

          <!-- Message count badge -->
          {#if hasMessages}
            <span class="badge bg-surface-300 text-surface-600 text-xs flex-shrink-0">{messages.length}</span>
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
