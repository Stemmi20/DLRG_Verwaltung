<script lang="ts">
	import { page } from '$app/stores';
	import 'virtual:uno.css';
	import { untrack, type Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Navbar from '$lib/components/Navbar.svelte';
	import Seitenleiste from '$lib/components/Seitenleiste.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const OHNE_NAVIGATION = ['/login'];

	const navZeigen = $derived(!OHNE_NAVIGATION.includes($page.url.pathname));
	// Die Leiste nur für Angemeldete – die Prüf-Links aus den Mails öffnen Leute ohne Konto.
	const leisteZeigen = $derived(navZeigen && !!data.user);

	// Startwert aus dem Cookie (auch beim Rendern auf dem Server), danach steuert die Leiste selbst.
	let leisteZu = $state(untrack(() => data.seitenleisteZu));
</script>

{#if navZeigen}
	<Navbar user={data.user} />
{/if}

{#if leisteZeigen}
	<div class="rahmen">
		<Seitenleiste bind:zu={leisteZu} user={data.user} />
		<main class="inhalt">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	:global(:root) {
		--navbar-hoehe: 72px;
	}
	@media (max-width: 850px) {
		:global(:root) {
			--navbar-hoehe: 60px;
		}
	}
	.rahmen {
		display: flex;
		align-items: flex-start;
		background: #0b1014;
	}
	/* min-width: 0, damit breite Tabellen/Karten nicht über den Rand drücken. */
	.inhalt {
		flex: 1;
		min-width: 0;
	}
</style>
