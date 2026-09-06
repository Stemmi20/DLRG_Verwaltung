<script lang="ts">
	import { page } from '$app/stores';
	import type { AppView } from '$lib/fleet/types';

	let {
		user,
	}: {
		user: { vorname: string; nachname: string; istAdmin: boolean } | null;
	} = $props();

	let menuOffen = $state(false);
	let abmelden = $state(false);

	const LINKS = [
		{ pfad: '/', label: 'Start' },
		{ pfad: '/boteinsatzgruppe', label: 'Einsatzgruppe' },
		{ pfad: '/fleetmanager', label: 'Fleetmanager' },
		{ pfad: '/kfausb', label: 'Kraftfahrer' },
	];

	/**
	 * Die vier Ansichten des Fleetmanagers. Sie stehen nur dort in der Leiste –
	 * auf allen anderen Seiten wären sie ohne Bedeutung.
	 */
	const ANSICHTEN: { id: AppView; label: string }[] = [
		{ id: 'home', label: 'Dashboard' },
		{ id: 'fleet', label: 'Fahrzeuge' },
		{ id: 'map', label: 'Karte' },
		{ id: 'users', label: 'Benutzer' },
	];

	const imFleetmanager = $derived($page.url.pathname.startsWith('/fleetmanager'));

	/*
	 * Die Ansicht steht in der URL, nicht in einer lokalen Variablen: Navbar und
	 * Seite lesen damit dieselbe Quelle, und der Zurück-Button funktioniert.
	 */
	const aktuelleAnsicht = $derived(($page.url.searchParams.get('view') as AppView) ?? 'home');

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
	<div class="leiste mx-auto flex max-w-7xl items-center gap-4 px-4">
		<!-- Links: Logo -->
		<a href="/" class="shrink-0" aria-label="Zur Startseite">
			<img src="/dlrg_og_fn.svg" alt="DLRG" class="h-10 w-auto" />
		</a>

		<!-- Mitte: Begrüßung -->
		<div class="min-w-0 flex-1 text-center">
			{#if user}
				<p class="truncate font-semibold color-[rgb(255,237,0)]">
					Hallo {user.vorname}, willkommen im DLRG Verwaltungsportal
				</p>
			{/if}
		</div>

		<!-- Rechts daneben: Bild und Ansichtswechsel, nur im Fleetmanager -->
		{#if imFleetmanager}
			<img class="fleetmap-bild shrink-0" src="/dlrg-fn-fleetmap.png" alt="Fleetmap" />
			<nav class="fleet-nav shrink-0" aria-label="Ansicht im Fleetmanager">
				{#each ANSICHTEN as ansicht}
					<a
						href="/fleetmanager?view={ansicht.id}"
						class:active={aktuelleAnsicht === ansicht.id}
						data-sveltekit-noscroll>{ansicht.label}</a
					>
				{/each}
			</nav>
		{/if}

		<!-- Ganz rechts: Abmelden und Menüknopf -->
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
				class="rounded-lg p-2 transition hover:bg-white/15"
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

	{#if menuOffen}
		<nav id="hauptmenue" class="menue" aria-label="Hauptnavigation">
			{#each LINKS as link}
				<a
					href={link.pfad}
					class:active={istAktiv(link.pfad)}
					onclick={() => (menuOffen = false)}>{link.label}</a
				>
			{/each}
		</nav>
	{/if}
</header>

<style>
	/*
	 * Die Höhe kommt aus einer Variablen, weil die Fleetmanager-Seite ihre
	 * eigene Höhe damit ausrechnet. Sie steht in src/routes/+layout.svelte.
	 */
	header {
		position: relative;
		height: var(--navbar-hoehe);
		border-bottom: 5px solid #ffed00;
	}
	.leiste {
		height: 100%;
	}

	.fleetmap-bild {
		width: 46px;
		height: 46px;
		object-fit: contain;
		filter: drop-shadow(0 4px 8px #83000955);
	}

	/* Segmentleiste, optisch wie vorher im Seitenkopf. */
	.fleet-nav {
		height: 42px;
		padding: 4px;
		border: 1px solid #ffffff26;
		border-radius: 9px;
		background: #99000b38;
		display: flex;
	}
	.fleet-nav a {
		display: flex;
		align-items: center;
		padding: 0 16px;
		border-radius: 6px;
		color: #ffffffb8;
		font-size: 11px;
		font-weight: 700;
		text-decoration: none;
		transition: 0.15s;
	}
	.fleet-nav a:hover {
		color: #fff;
	}
	.fleet-nav a.active {
		background: #ffed00;
		color: #575756;
	}

	.menue {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 1200;
		padding: 6px 16px 12px;
		background: #e30613;
		border-bottom: 5px solid #ffed00;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.menue a {
		padding: 10px 12px;
		border-radius: 8px;
		color: #fff;
		font-weight: 700;
		text-decoration: none;
	}
	.menue a.active {
		background: #ffffff1f;
	}

	/* Auf schmalen Geräten übernimmt die untere Leiste der Seite. */
	@media (max-width: 850px) {
		.fleetmap-bild,
		.fleet-nav {
			display: none;
		}
	}
</style>