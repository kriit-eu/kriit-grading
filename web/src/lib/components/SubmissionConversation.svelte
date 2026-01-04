<script lang="ts">
  import type { Message } from '$lib/stores/grading';

  export let messages: Message[] = [];

  // Track which message results are expanded
  // Failed messages start expanded, successful ones start collapsed
  let expandedResults: Set<string> = new Set(
    messages.filter(m => m.failed).map(m => m.id)
  );

  // Update expanded state when messages change
  $: {
    const failedIds = new Set(messages.filter(m => m.failed).map(m => m.id));
    // Add new failed messages to expanded set
    for (const id of failedIds) {
      if (!expandedResults.has(id)) {
        expandedResults.add(id);
        expandedResults = expandedResults;
      }
    }
  }

  function toggleResult(id: string) {
    if (expandedResults.has(id)) {
      expandedResults.delete(id);
    } else {
      expandedResults.add(id);
    }
    expandedResults = expandedResults;
  }
</script>

{#if messages.length > 0}
  <div class="conversation mt-2 ml-4 border-l-2 border-surface-300 pl-3">
    {#each messages as message (message.id)}
      {@const isResultExpanded = expandedResults.has(message.id)}
      <div
        class="message mb-2 rounded text-sm overflow-hidden"
        class:bg-error-100={message.failed}
        class:bg-surface-100={!message.failed}
      >
        <!-- Action (top part) - clickable to expand/collapse result -->
        <button
          class="action w-full text-left p-2 font-medium text-surface-700 flex items-center gap-2 {message.failed ? 'hover:bg-error-200/50' : 'hover:bg-surface-200/50'}"
          on:click={() => message.result && toggleResult(message.id)}
          disabled={!message.result}
        >
          {#if message.result}
            <span class="text-surface-400 text-xs">{isResultExpanded ? '▼' : '►'}</span>
          {/if}
          <span>{message.action}</span>
        </button>
        <!-- Result (bottom part) - collapsible -->
        {#if message.result && isResultExpanded}
          <div class="result px-2 pb-2 text-surface-500 font-mono text-xs whitespace-pre-wrap border-t border-surface-200/50">
            {message.result}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
