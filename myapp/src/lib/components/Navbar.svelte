<script lang="ts">
	import { page } from '$app/stores';
	import type {
		AppView,
		ConnectionStatus,
	} from '$lib/fleet/types';

	let {
		user,
	}: {
		user: { vorname: string; nachname: string; istAdmin: boolean } | null;
	} = $props();

	let menuOffen = $state(false);
	let abmelden = $state(false);

	let connection = $state<ConnectionStatus>('connecting'),
		view = $state<AppView>('home');






	const LINKS = [
		{ pfad: '/', label: 'Start' },
		{ pfad: '/boteinsatzgruppe', label: 'Einsatzgruppe' },
		// { pfad: '/fleetmanager', label: 'Fleetmanager' },
		{ pfad: '/kfausb', label: 'Kraftfahrer' },
	];

	function istAktiv(pfad: string): boolean {
		const aktuell = $page.url.pathname;
		return pfad === '/' ? aktuell === '/' : aktuell.startsWith(pfad);
	}

	async function abmeldenKlick() {
		abmelden = true;
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<header class="bg-[rgb(227,6,19)] font-dlrg-normal color-white">
	<div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
		<!-- Links: Logo -->
		<a href="/" class="shrink-0" aria-label="Zur Startseite">
			<img src="/dlrg_og_fn.svg" alt="DLRG" class="h-10 w-auto" />
		</a>

		<!-- Mitte: Begrüßung und Titel -->
		<div class="min-w-0 flex-1 text-center">
			{#if user}
				<p class="truncate font-semibold color-[rgb(255,237,0)]">
					Hallo {user.vorname}, Wilkommen im DLRG Verwaltungsportal
				</p>
			{/if}
		</div>

		<div class="min-w-0 flex-1 text-center header-inner app" class:home-view={view !== 'map'}>
			<nav>
				<button class:active={view === 'home'} onclick={() => (view = 'home')}>Dashboard</button><button
					class:active={view === 'fleet'}
					onclick={() => (view = 'fleet')}>Fahrzeuge</button
				><button class:active={view === 'map'} onclick={() => (view = 'map')}>Karte</button><button
					class:active={view === 'users'}
					onclick={() => (view = 'users')}>Benutzer</button
				>
			</nav>
		</div>

		<!-- Rechts: Abmelden und Menüknopf -->
		<div class="flex shrink-0 items-center gap-2">
			{#if user}
				<button
					type="button"
					onclick={abmeldenKlick}
					disabled={abmelden}
					class="rounded-lg bg-[rgb(255,237,0)] px-4 py-2 color-black transition hover:bg-yellow-300 disabled:opacity-60"
				>
					{abmelden ? 'Wird abgemeldet …' : 'Abmelden'}
				</button>
			{:else}
				<a
					href="/login"
					class="rounded-lg bg-[rgb(255,237,0)] px-4 py-2 color-black transition hover:bg-yellow-300"
				>
					Anmelden
				</a>
			{/if}

			<button
				type="button"
				onclick={() => (menuOffen = !menuOffen)}
				aria-expanded={menuOffen}
				aria-controls="hauptmenue"
				aria-label={menuOffen ? 'Menü schließen' : 'Menü öffnen'}
				class="rounded-lg p-2 transition hover:bg-white/15 lg:hidden"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					aria-hidden="true"
				>
					{#if menuOffen}
						<path d="M18 6 6 18M6 6l12 12" />
					{:else}
						<path d="M3 6h18M3 12h18M3 18h18" />
					{/if}
				</svg>
			</button>
		</div>
	</div>
</header>


<style>
	@media (max-width: 850px) {
		.app,
		.app.home-view {
			height: 100dvh;
			min-height: 0;
			grid-template-rows: 60px minmax(0, 1fr) 68px !important;
		}
		.app > header {
			height: 60px;
			padding: 0 14px;
		}
		.app .header-inner {
			display: flex;
			justify-content: center;
		}
		.app .header-inner > nav,
		.app .header-inner .right,
		.brand span,
		.brand-divider,
		.fleetmap-header {
			display: none !important;
		}
		.app .header-inner .brand > img:first-child {
			width: 82px;
		}
		.toolbar {
			display: none;
		}
		.dashboard {
			position: relative;
			margin: 0;
			display: block;
			border: 0;
			border-radius: 0;
			box-shadow: none;
			overflow: hidden;
		}
		.map-shell {
			position: absolute;
			inset: 0;
		}
		.map-label {
			top: 14px;
			left: 14px;
		}
		.dashboard > aside {
			position: absolute;
			z-index: 750;
			left: 10px;
			right: 10px;
			bottom: 10px;
			height: min(64vh, 520px);
			border: 0;
			border-radius: 15px 15px 10px 10px;
			box-shadow: 0 12px 40px #0005;
			transform: translateY(calc(100% - 58px));
			transition: transform 0.25s ease;
			overflow: hidden;
		}
		.dashboard > aside.sheet-open {
			transform: translateY(0);
		}
		.sheet-handle {
			height: 58px;
			flex: none;
			padding: 0 18px;
			border: 0;
			border-bottom: 1px solid #e5e5e3;
			background: #fff;
			color: #575756;
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.sheet-handle i {
			position: absolute;
			top: 7px;
			left: 50%;
			width: 36px;
			height: 4px;
			border-radius: 5px;
			background: #c8c8c5;
		}
		.sheet-handle span {
			font-weight: 700;
		}
		.sheet-handle b {
			margin-left: auto;
			color: #e30613;
			font-size: 18px;
		}
		.aside-head {
			display: none;
		}
		.list {
			flex: 1;
		}
		.route-control {
			flex: none;
		}
		.legend {
			display: none;
		}
		.mobile-map-actions {
			position: absolute;
			z-index: 600;
			right: 12px;
			top: 14px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.mobile-map-actions button {
			width: 48px;
			min-height: 48px;
			padding: 6px 3px;
			border: 0;
			border-radius: 9px;
			background: #fff;
			color: #575756;
			box-shadow: 0 4px 15px #0003;
			font-size: 18px;
			font-weight: 700;
		}
		.mobile-map-actions span {
			display: block;
			margin-top: 2px;
			font-size: 7px;
		}
		.mobile-map-actions button.active {
			background: #e30613;
			color: #fff;
		}
		.mobile-map-actions button:disabled {
			opacity: 0.45;
		}
		.mobile-nav {
			z-index: 1000;
			padding: 5px 7px max(5px, env(safe-area-inset-bottom));
			border-top: 1px solid #d4d4d1;
			background: #fff;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			box-shadow: 0 -4px 18px #0002;
		}
		.mobile-nav button {
			border: 0;
			border-radius: 8px;
			background: transparent;
			color: #777;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			font-size: 8px;
		}
		.mobile-nav button.active {
			background: #e3061310;
			color: #e30613;
			font-weight: 700;
		}
	}
</style>