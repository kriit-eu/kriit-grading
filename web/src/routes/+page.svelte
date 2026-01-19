<script lang="ts">
	import { gradingStore, progressPercent, isOperationRunning, totalSubmissions, totalUngraded, allSubmissions } from '$lib/stores/grading';
	import { isTerminalRunning } from '$lib/stores/terminal';
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

<!-- Two-column responsive layout: terminal left, content right on wide screens -->
<div class="flex flex-col lg:flex-row gap-6 h-full">
	<!-- Terminal (left side on wide, top on narrow) -->
	<div class="lg:w-auto lg:max-w-[950px] flex-shrink-0">
		<Terminal />
	</div>

	<!-- Main content (right side on wide, bottom on narrow) -->
	<div class="flex-1 space-y-6 min-w-0">
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

		<!-- Statistics Cards -->
		<StatCards
			totalSubmissions={$totalSubmissions}
			totalUngraded={$totalUngraded}
			plagiarismMatches={$gradingStore.plagiarismMatches.length}
			connected={$gradingStore.connected}
		/>

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
				onclick={restartServer}
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
</div>
