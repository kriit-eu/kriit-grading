<script lang="ts">
  import type { Assignment } from '$lib/stores/grading';

  export let assignments: Assignment[] = [];
</script>

{#if assignments.length === 0}
  <div class="card p-6 variant-soft-surface text-center">
    <p class="text-surface-600">Ülesandeid pole veel laaditud.</p>
    <p class="text-sm text-surface-500 mt-2">Käivita <code class="bg-surface-200 px-1 rounded">bun list</code> terminalis.</p>
  </div>
{:else}
  <div class="card variant-soft-surface overflow-hidden">
    <table class="table table-hover w-full">
      <thead>
        <tr class="bg-surface-200">
          <th class="text-left p-3">ID</th>
          <th class="text-left p-3">Ülesanne</th>
          <th class="text-right p-3">Esitused</th>
          <th class="text-right p-3">Hindamata</th>
        </tr>
      </thead>
      <tbody>
        {#each assignments as assignment (assignment.id)}
          <tr class="border-b border-surface-300">
            <td class="p-3 text-surface-600">#{assignment.id}</td>
            <td class="p-3 font-medium">{assignment.name}</td>
            <td class="p-3 text-right">{assignment.submissions}</td>
            <td class="p-3 text-right">
              {#if assignment.ungraded > 0}
                <span class="badge bg-primary-500 text-primary-900">{assignment.ungraded}</span>
              {:else}
                <span class="text-success-600">0</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
