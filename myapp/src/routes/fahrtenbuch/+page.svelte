<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function datum(iso: string | null): string {
		return iso ? new Date(iso).toLocaleDateString('de-DE') : 'noch keine Fahrt';
	}
</script>

<svelte:head><title>Fahrtenbuch</title></svelte:head>

<div class="seite">
	<header>
		<p>Fahrzeuge</p>
		<h1>Fahrtenbuch</h1>
		<span>Wähle das Fahrzeug, für das du eine Fahrt eintragen möchtest.</span>
	</header>

	<div class="karten">
		{#each data.fahrzeuge as f (f.id)}
			<a class="karte" href="/fahrtenbuch/{f.id}">
				<strong>{f.funkrufname}</strong>
				<div class="werte">
					<span><small>Kilometerstand</small><b>{f.kmStand.toLocaleString('de-DE')} km</b></span>
					<span><small>Sitzplätze</small><b>{f.sitzplaetze}</b></span>
					<span><small>Letzte Fahrt</small><b>{datum(f.letzteFahrt)}</b></span>
				</div>
				<em>Fahrtenbuch öffnen →</em>
			</a>
		{/each}
	</div>

	{#if data.fahrzeuge.length === 0}
		<p class="leer">
			Noch keine Fahrzeuge angelegt. Führe <code>pnpm exec tsx prisma/seed.ts</code> aus.
		</p>
	{/if}
</div>

<style>
	.seite {
		min-height: 100vh;
		padding: 38px max(24px, calc((100vw - 1200px) / 2)) 48px;
		background: radial-gradient(circle at 50% -25%, #dededb, #c8c8c5 65%);
		color: #575756;
	}
	header p {
		margin: 0 0 7px;
		color: #e30613;
		text-transform: uppercase;
		letter-spacing: 1.7px;
		font-size: 9px;
		font-weight: 700;
	}
	header h1 {
		margin: 0;
		font-size: 35px;
	}
	header span {
		display: block;
		margin-top: 8px;
		color: #747473;
		font-size: 12px;
	}
	.karten {
		margin-top: 26px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 18px;
	}
	.karte {
		position: relative;
		padding: 22px;
		border-radius: 12px;
		background: #fff;
		box-shadow: 0 10px 30px #57575617;
		text-decoration: none;
		color: #575756;
		display: block;
		transition: 0.2s;
	}
	.karte:before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 5px;
		border-radius: 12px 12px 0 0;
		background: #e30613;
	}
	.karte:hover {
		transform: translateY(-3px);
		box-shadow: 0 16px 36px #57575626;
	}
	.karte > strong {
		display: block;
		margin-top: 6px;
		font-size: 17px;
	}
	.werte {
		margin: 16px 0 14px;
		display: grid;
		gap: 9px;
	}
	.werte span {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: 7px;
		border-bottom: 1px solid #ececea;
	}
	.werte small {
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		font-size: 8px;
	}
	.werte b {
		font-size: 13px;
	}
	.karte em {
		color: #e30613;
		font-style: normal;
		font-size: 10px;
		font-weight: 700;
	}
	.leer {
		margin-top: 24px;
		padding: 24px;
		border-radius: 10px;
		background: #fff;
		text-align: center;
		font-size: 12px;
	}
	code {
		padding: 2px 6px;
		border-radius: 4px;
		background: #f1f1ef;
		font-size: 11px;
	}
</style>