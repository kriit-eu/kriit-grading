<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { gradingStore } from '$lib/stores/grading';
	import { settingsStore, getActiveUrl } from '$lib/stores/settings';
	import { onMount, onDestroy } from 'svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';

	let { children } = $props();
	let settingsOpen = $state(false);
	let settings = $state($settingsStore);
	let isCleaning = $state(false);

	settingsStore.subscribe(value => {
		settings = value;
	});

	async function cleanFiles() {
		if (isCleaning) return;
		isCleaning = true;
		try {
			const response = await fetch('/api/clean', { method: 'POST' });
			const result = await response.json();
			if (!result.success) {
				console.error('Clean failed:', result.error);
			} else {
				console.log('Clean result:', result.message);
			}
		} catch (error) {
			console.error('Clean error:', error);
		} finally {
			isCleaning = false;
		}
	}

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
		<div class="container mx-auto px-4 py-4 flex items-center justify-between">
			<h1 class="text-xl font-bold text-surface-900 dark:text-surface-50">
				Kriit Hindamisdashboard
			</h1>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-sm variant-soft-surface"
					onclick={cleanFiles}
					disabled={isCleaning}
					title="Kustuta kloonitud repod, plagiaadiraportid ja batch fail"
				>
					{isCleaning ? 'Puhastab...' : 'Puhasta'}
				</button>
				<span class="text-sm px-2 py-1 rounded {settings.environment === 'dev' ? 'bg-primary-500 text-white' : 'bg-warning-500 text-black'}">
					{settings.environment === 'dev' ? 'DEV' : 'PROD'}
				</span>
				<button
					class="btn-icon btn-icon-sm variant-ghost-surface"
					onclick={() => settingsOpen = true}
					aria-label="Seaded"
					title="Seaded"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
		</div>
	</header>

	<main class="container mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>

<SettingsModal bind:open={settingsOpen} />
