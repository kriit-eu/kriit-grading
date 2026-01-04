<script lang="ts">
	import { gradingStore, progressPercent, isOperationRunning, totalSubmissions, totalUngraded } from '$lib/stores/grading';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StatCards from '$lib/components/StatCards.svelte';
	import AssignmentList from '$lib/components/AssignmentList.svelte';
	import SubmissionList from '$lib/components/SubmissionList.svelte';
	import PlagiarismList from '$lib/components/PlagiarismList.svelte';
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

	<!-- Statistics Cards -->
	<StatCards
		totalAssignments={$gradingStore.assignments.length}
		totalSubmissions={$totalSubmissions}
		totalUngraded={$totalUngraded}
		plagiarismMatches={$gradingStore.plagiarismMatches.length}
		connected={$gradingStore.connected}
	/>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Assignments List -->
		<div>
			<h2 class="text-lg font-semibold mb-3">Ülesanded</h2>
			<AssignmentList assignments={$gradingStore.assignments} />
		</div>

		<!-- Submission Progress (shown when there are submissions being processed) -->
		<div>
			<h2 class="text-lg font-semibold mb-3">Esituste progress</h2>
			<SubmissionList
				submissions={$gradingStore.submissions}
				title={$gradingStore.currentOperation === 'clone' ? 'Kloonimine' : 'Esitused'}
			/>
		</div>
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

	<!-- Last Updated -->
	{#if $gradingStore.lastUpdated}
		<p class="text-sm text-surface-500 text-right">
			Viimati uuendatud: {new Date($gradingStore.lastUpdated).toLocaleString('et-EE')}
		</p>
	{/if}
</div>
