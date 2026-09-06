<script lang="ts">
	import { page } from '$app/stores';	
	import 'virtual:uno.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Navbar from '$lib/components/Navbar.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const OHNE_NAVIGATION = ['/login'];

	const navZeigen = $derived(!OHNE_NAVIGATION.includes($page.url.pathname));
</script>

{#if navZeigen}
	<Navbar user={data.user} />
{/if}

{@render children()}

<style>
	:global(:root) {
		--navbar-hoehe: 72px;
	}
	@media (max-width: 850px) {
		:global(:root) {
			--navbar-hoehe: 60px;
		}
	}
</style>