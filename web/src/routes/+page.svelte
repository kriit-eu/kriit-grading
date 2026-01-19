<script lang="ts">
	import { gradingStore, progressPercent, isOperationRunning, totalSubmissions, totalUngraded, allSubmissions } from '$lib/stores/grading';
	import { terminalStore, isTerminalVisible, isTerminalRunning } from '$lib/stores/terminal';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StatCards from '$lib/components/StatCards.svelte';
	import AssignmentList from '$lib/components/AssignmentList.svelte';
	import PlagiarismList from '$lib/components/PlagiarismList.svelte';
	import Terminal from '$lib/components/Terminal.svelte';

	async function restartServer() {
		try {
			await fetch('/api/restart', { method: 'POST' });
			// Server will restart, page will reconnect automatically
		} catch {
			// Expected - server is restarting
		}
		// Reload page after short delay
		setTimeout(() => window.location.reload(), 2000);
	}
</script>

<div class="space-y-6">
	<!-- Progress Bar - shown when operation is running -->
	{#if $isOperationRunning}
		<ProgressBar
			progress={$progressPercent}
			total={$gradingStore.progress.total}
			completed={$gradingStore.progress.completed}
			failed={$gradingStore.progress.failed}
			operation={$gradingStore.currentOperation}
		/>
	{/if}

	<!-- Terminal Toggle + Statistics Cards -->
	<div class="flex items-start gap-4">
		<button
			type="button"
			class="btn {$isTerminalVisible ? 'variant-filled-primary' : 'variant-soft-primary'} flex items-center gap-2"
			on:click={() => terminalStore.toggle()}
		>
			<span class="text-lg">{$isTerminalVisible ? '▼' : '▶'}</span>
			Terminal
			{#if $isTerminalRunning}
				<span class="badge bg-success-500 text-xs px-1.5 py-0.5 rounded animate-pulse">●</span>
			{/if}
		</button>
		<div class="flex-1">
			<StatCards
				totalSubmissions={$totalSubmissions}
				totalUngraded={$totalUngraded}
				plagiarismMatches={$gradingStore.plagiarismMatches.length}
				connected={$gradingStore.connected}
			/>
		</div>
	</div>

	<!-- Terminal (collapsible) -->
	{#if $isTerminalVisible}
		<Terminal />
	{/if}

	<!-- Individual Submissions List -->
	<div>
		<h2 class="text-lg font-semibold mb-3">Esitused</h2>
		<AssignmentList submissions={$allSubmissions} />
	</div>

	<!-- Plagiarism Matches (shown if any exist) -->
	{#if $gradingStore.plagiarismMatches.length > 0}
		<div>
			<h2 class="text-lg font-semibold mb-3">Plagiaadikontroll</h2>
			<PlagiarismList matches={$gradingStore.plagiarismMatches} />
		</div>
	{/if}

	<!-- Errors (shown if any exist) -->
	{#if $gradingStore.errors.length > 0}
		<div class="card variant-soft-error p-4">
			<h3 class="font-semibold text-error-700 mb-2">Vead</h3>
			<ul class="list-disc list-inside space-y-1">
				{#each $gradingStore.errors as error}
					<li class="text-error-600">{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Footer info -->
	<div class="text-sm text-surface-500 flex justify-between items-end">
		<button
			class="btn btn-sm variant-soft-surface"
			on:click={restartServer}
		>
			Taaskäivita server
		</button>
		<div class="text-right space-y-1">
			{#if $gradingStore.serverStartedAt}
				<p>Server käivitatud: {new Date($gradingStore.serverStartedAt).toLocaleString('et-EE')}</p>
			{/if}
			{#if $gradingStore.lastUpdated}
				<p>{$gradingStore.workingDirectory} · Viimati uuendatud: {new Date($gradingStore.lastUpdated).toLocaleString('et-EE')}</p>
			{/if}
		</div>
	</div>
</div>
