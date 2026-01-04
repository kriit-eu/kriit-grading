<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { gradingStore } from '$lib/stores/grading';
	import { onMount, onDestroy } from 'svelte';

	let { children } = $props();

	onMount(() => {
		gradingStore.connect();
	});

	onDestroy(() => {
		gradingStore.disconnect();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Kriit Grading Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-surface-50 dark:bg-surface-900" data-theme="skeleton">
	<header class="bg-surface-200 dark:bg-surface-800 shadow-sm">
		<div class="container mx-auto px-4 py-4">
			<h1 class="text-xl font-bold text-surface-900 dark:text-surface-50">
				Kriit Hindamisdashboard
			</h1>
		</div>
	</header>

	<main class="container mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>
