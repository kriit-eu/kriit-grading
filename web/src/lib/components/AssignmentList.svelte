<script lang="ts">
  import type { FlatSubmission, Message } from '$lib/stores/grading';
  import { gradingStore } from '$lib/stores/grading';
  import SubmissionConversation from './SubmissionConversation.svelte';

  export let submissions: FlatSubmission[] = [];

  // Track expanded state per submission - all start collapsed
  let expandedSubmissions: Set<string> = new Set();

  // Track if "Valmis" section is expanded - collapsed by default
  let completedSectionExpanded = false;

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

  // Split submissions into active and completed
  $: activeSubmissions = submissions.filter(s => !s.isGraded);
  $: completedSubmissions = submissions.filter(s => s.isGraded);

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

    // Google Drive document (no git clone, graded via MCP tools)
    if (cloneStatus?.status === 'google-drive') {
      return { text: 'Dokument', class: 'bg-violet-500 text-white' };
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

{#snippet submissionRow(submission: FlatSubmission)}
  {@const key = getSubmissionKey(submission)}
  {@const messages = $gradingStore.messages[key] || []}
  {@const cloneStatus = $gradingStore.submissions[key]}
  {@const isExpanded = expandedSubmissions.has(key)}
  {@const hasMessages = messages.length > 0}
  {@const statusBadge = getStatusBadge(submission, cloneStatus, messages)}
  {@const hasError = statusBadge.text === 'Viga'}

  <div class="border-b border-surface-300 last:border-b-0">
    <button
      class="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-surface-200 transition-colors"
      class:cursor-pointer={hasMessages}
      class:cursor-default={!hasMessages}
      class:bg-error-50={hasError}
      onclick={() => hasMessages && toggleExpanded(key)}
    >
      <span class="w-4 text-surface-400 flex-shrink-0">
        {#if hasMessages}
          {#if isExpanded}▼{:else}►{/if}
        {/if}
      </span>
      <span class="font-medium flex-shrink-0 w-36 truncate">{submission.studentName}</span>
      <span class="text-surface-600 flex-1 truncate text-sm">
        <span class="text-surface-400">#{submission.assignmentId}</span>
        {submission.assignmentName}
      </span>
      <span class="text-surface-500 text-xs flex-shrink-0">{formatDate(submission.submittedAt)}</span>
      <span class="flex-shrink-0">
        {#if statusBadge.text === 'Hindamata' && $gradingStore.kriitUrl}
          <a
            href="{$gradingStore.kriitUrl}/assignments/{submission.assignmentId}/students/{submission.userId}"
            target="_blank"
            rel="noopener noreferrer"
            class="badge {statusBadge.class} hover:opacity-80 transition-opacity"
            onclick={(e) => e.stopPropagation()}
          >{statusBadge.text} ↗</a>
        {:else}
          <span class="badge {statusBadge.class}">{statusBadge.text}</span>
        {/if}
      </span>
      {#if hasMessages}
        <span class="badge bg-surface-300 text-surface-600 text-xs flex-shrink-0">{messages.length}</span>
      {/if}
    </button>
    {#if isExpanded && hasMessages}
      <SubmissionConversation {messages} />
    {/if}
  </div>
{/snippet}

{#if submissions.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Esitusi pole veel laaditud.</p>
    <p class="text-sm text-surface-500 mt-2">Käivita <code class="bg-surface-200 px-1 rounded">claude "Hinda kõik esitused"</code></p>
  </div>
{:else}
  <!-- Active submissions -->
  {#if activeSubmissions.length > 0}
    <div class="card variant-soft-surface overflow-hidden">
      {#each activeSubmissions as submission (submission.userId + '-' + submission.assignmentId)}
        {@render submissionRow(submission)}
      {/each}
    </div>
  {/if}

  <!-- Completed submissions (collapsible) -->
  {#if completedSubmissions.length > 0}
    <div class="card variant-soft-surface overflow-hidden mt-4">
      <button
        class="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-surface-200 transition-colors font-medium text-surface-600"
        onclick={() => completedSectionExpanded = !completedSectionExpanded}
      >
        <span class="w-4 text-surface-400">
          {#if completedSectionExpanded}▼{:else}►{/if}
        </span>
        <span>Valmis</span>
        <span class="badge bg-success-500 text-white">{completedSubmissions.length}</span>
      </button>
      {#if completedSectionExpanded}
        {#each completedSubmissions as submission (submission.userId + '-' + submission.assignmentId)}
          {@render submissionRow(submission)}
        {/each}
      {/if}
    </div>
  {/if}
{/if}
